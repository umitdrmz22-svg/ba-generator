alter table public.ehs_companies add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
update public.ehs_companies c
set organization_id=(select w.organization_id from public.ehs_werks w where w.company_id=c.id order by w.created_at limit 1)
where c.organization_id is null;
create unique index if not exists ehs_companies_organization_key on public.ehs_companies(organization_id) where organization_id is not null;

create table if not exists public.ehs_vendor_admin_emails(
  email text primary key,
  role text not null default 'owner' check(role in ('owner','admin')),
  status text not null default 'active' check(status in ('active','disabled')),
  created_at timestamptz not null default now(),
  constraint ehs_vendor_admin_email_normalized check(email=lower(trim(email)))
);

insert into public.ehs_vendor_admin_emails(email,role,status)
values('umit.durmaz@gmx.de','owner','active')
on conflict(email) do update set role=excluded.role,status=excluded.status;

create table if not exists public.ehs_vendor_audit_log(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  company_id uuid references public.ehs_companies(id) on delete set null,
  werk_id uuid references public.ehs_werks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ehs_vendor_admin_emails enable row level security;
alter table public.ehs_vendor_audit_log enable row level security;
revoke all on public.ehs_vendor_admin_emails from anon,authenticated;
revoke all on public.ehs_vendor_audit_log from anon,authenticated;
drop policy if exists ehs_server_only_deny_all on public.ehs_vendor_admin_emails;
create policy ehs_server_only_deny_all on public.ehs_vendor_admin_emails for all to anon,authenticated using(false) with check(false);
drop policy if exists ehs_server_only_deny_all on public.ehs_vendor_audit_log;
create policy ehs_server_only_deny_all on public.ehs_vendor_audit_log for all to anon,authenticated using(false) with check(false);
