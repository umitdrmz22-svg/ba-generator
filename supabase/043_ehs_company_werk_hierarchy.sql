-- DefiDev EHS — company -> Werk -> user hierarchy
-- Stand: 2026-08-16
-- Applied live as migration: ehs_company_werk_hierarchy.

begin;

create table if not exists public.ehs_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 180),
  legal_name text,
  billing_email text,
  vat_id text,
  status text not null default 'active' check (status in ('active','suspended','canceled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ehs_company_admins (
  company_id uuid not null references public.ehs_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','billing')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

alter table public.ehs_werks add column if not exists company_id uuid references public.ehs_companies(id) on delete cascade;
create unique index if not exists ehs_werks_one_operational_org on public.ehs_werks(organization_id);
create index if not exists ehs_werks_company_idx on public.ehs_werks(company_id);
create index if not exists ehs_werk_members_user_idx on public.ehs_werk_members(user_id);

create or replace function public.ehs_sync_werk_member_to_org()
returns trigger language plpgsql as $$
declare
  org_id uuid;
  mapped_role text;
begin
  select organization_id into org_id from public.ehs_werks where id=new.werk_id;
  if org_id is null then raise exception 'WERK_ORGANIZATION_NOT_FOUND'; end if;
  mapped_role := case new.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'editor' then 'ersteller'
    when 'reader' then 'leser'
    else 'leser'
  end;
  insert into public.organization_members(organization_id,user_id,role,status)
  values(org_id,new.user_id,mapped_role,new.status)
  on conflict (organization_id,user_id) do update set role=excluded.role,status=excluded.status;
  return new;
end;
$$;

drop trigger if exists ehs_werk_member_org_sync on public.ehs_werk_members;
create trigger ehs_werk_member_org_sync
after insert or update of seat_type,role,status on public.ehs_werk_members
for each row execute function public.ehs_sync_werk_member_to_org();

create or replace function public.ehs_remove_werk_member_from_org()
returns trigger language plpgsql as $$
declare
  org_id uuid;
begin
  select organization_id into org_id from public.ehs_werks where id=old.werk_id;
  if org_id is not null then
    delete from public.organization_members where organization_id=org_id and user_id=old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists ehs_werk_member_org_delete_sync on public.ehs_werk_members;
create trigger ehs_werk_member_org_delete_sync
after delete on public.ehs_werk_members
for each row execute function public.ehs_remove_werk_member_from_org();

alter table public.ehs_companies enable row level security;
alter table public.ehs_company_admins enable row level security;
revoke all on public.ehs_companies from anon, authenticated;
revoke all on public.ehs_company_admins from anon, authenticated;
revoke execute on function public.ehs_sync_werk_member_to_org() from public, anon, authenticated;
revoke execute on function public.ehs_remove_werk_member_from_org() from public, anon, authenticated;

comment on table public.ehs_companies is 'Corporate customer master. A company can contain multiple independently licensed Werke.';
comment on column public.ehs_werks.organization_id is 'Operational data scope for exactly one Werk; existing EHS RLS remains isolated per Werk via organization_members.';

commit;
