-- BA Studio: online gespeicherte Betriebsanweisungen
-- Voraussetzung: gemeinsames Core-Schema aus gefahrstoffkataster-online/supabase/001_core_and_kataster.sql

create table if not exists public.operating_instructions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  ba_number text not null default '',
  ba_type text not null check(ba_type in ('Gefahrstoff','Arbeitsmittel','PSA','Biostoff')),
  department text not null default '',
  workplace text not null default '',
  revision_label text not null default '',
  status text not null default 'draft' check(status in ('draft','approved','archived')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operating_instructions_org_title_idx
  on public.operating_instructions(organization_id,lower(title));
create index if not exists operating_instructions_org_status_idx
  on public.operating_instructions(organization_id,status);

create or replace function public.ba_set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists operating_instructions_updated_at on public.operating_instructions;
create trigger operating_instructions_updated_at
before update on public.operating_instructions
for each row execute function public.ba_set_updated_at();

alter table public.operating_instructions enable row level security;

drop policy if exists ba_select_member on public.operating_instructions;
create policy ba_select_member on public.operating_instructions
for select to authenticated
using(public.is_org_member(organization_id));

drop policy if exists ba_insert_editor on public.operating_instructions;
create policy ba_insert_editor on public.operating_instructions
for insert to authenticated
with check(
  public.has_org_role(organization_id,array['owner','admin','ersteller'])
  and created_by=auth.uid()
  and updated_by=auth.uid()
);

drop policy if exists ba_update_editor on public.operating_instructions;
create policy ba_update_editor on public.operating_instructions
for update to authenticated
using(public.has_org_role(organization_id,array['owner','admin','ersteller','pruefer']))
with check(
  public.has_org_role(organization_id,array['owner','admin','ersteller','pruefer'])
  and updated_by=auth.uid()
);

drop policy if exists ba_delete_admin on public.operating_instructions;
create policy ba_delete_admin on public.operating_instructions
for delete to authenticated
using(public.has_org_role(organization_id,array['owner','admin']));

grant select,insert,update,delete on public.operating_instructions to authenticated;
