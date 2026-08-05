-- BA Studio: Benutzer, Firmenbereiche und Rollen
-- Im Supabase SQL Editor einmalig ausführen.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','ersteller','pruefer','freigeber','leser')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member" on public.organizations
for select to authenticated using (public.is_org_member(id));

drop policy if exists "organizations_update_admin" on public.organizations;
create policy "organizations_update_admin" on public.organizations
for update to authenticated
using (public.has_org_role(id,array['owner','admin']))
with check (public.has_org_role(id,array['owner','admin']));

drop policy if exists "members_select_same_org" on public.organization_members;
create policy "members_select_same_org" on public.organization_members
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "members_insert_admin" on public.organization_members;
create policy "members_insert_admin" on public.organization_members
for insert to authenticated
with check (public.has_org_role(organization_id,array['owner','admin']));

drop policy if exists "members_update_admin" on public.organization_members;
create policy "members_update_admin" on public.organization_members
for update to authenticated
using (public.has_org_role(organization_id,array['owner','admin']))
with check (public.has_org_role(organization_id,array['owner','admin']));

drop policy if exists "members_delete_admin" on public.organization_members;
create policy "members_delete_admin" on public.organization_members
for delete to authenticated
using (public.has_org_role(organization_id,array['owner','admin']));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  requested_name text;
begin
  insert into public.profiles(id,full_name)
  values (new.id,coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;

  requested_name := nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name','')),'');
  insert into public.organizations(name,created_by)
  values (coalesce(requested_name,'Mein Unternehmen'),new.id)
  returning id into new_org_id;

  insert into public.organization_members(organization_id,user_id,role,status)
  values (new_org_id,new.id,'owner','active');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant usage on schema public to authenticated;
grant select,update on public.profiles to authenticated;
grant select,update on public.organizations to authenticated;
grant select,insert,update,delete on public.organization_members to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid,text[]) to authenticated;
