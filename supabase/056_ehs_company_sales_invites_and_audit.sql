-- Corporate sales/onboarding schema for DefiDev EHS.
-- These tables are server-managed; direct client grants remain revoked.

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

create table if not exists public.ehs_werk_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ehs_companies(id) on delete cascade,
  werk_id uuid not null references public.ehs_werks(id) on delete cascade,
  email text not null,
  seat_type text not null check (seat_type in ('editor','reader')),
  role text not null check (role in ('owner','admin','editor','reader')),
  status text not null default 'pending' check (status in ('pending','claimed','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now()+interval '14 days'),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ehs_werk_invites_email_normalized check (email=lower(trim(email))),
  constraint ehs_werk_invites_role_seat_match check (
    (seat_type='reader' and role='reader') or
    (seat_type='editor' and role in ('owner','admin','editor'))
  )
);

create unique index if not exists ehs_werk_invites_one_pending
  on public.ehs_werk_invites(werk_id,email) where status='pending';
create index if not exists ehs_werk_invites_company_idx
  on public.ehs_werk_invites(company_id,werk_id,status);
create index if not exists ehs_werk_invites_email_idx
  on public.ehs_werk_invites(email,status,expires_at);

create table if not exists public.ehs_company_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ehs_companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ehs_companies enable row level security;
alter table public.ehs_company_admins enable row level security;
alter table public.ehs_werk_invites enable row level security;
alter table public.ehs_company_audit_log enable row level security;

revoke all on public.ehs_companies from anon, authenticated;
revoke all on public.ehs_company_admins from anon, authenticated;
revoke all on public.ehs_werk_invites from anon, authenticated;
revoke all on public.ehs_company_audit_log from anon, authenticated;
