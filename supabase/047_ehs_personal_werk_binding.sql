create table if not exists public.ehs_personal_werk_bindings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ehs_personal_werk_bindings enable row level security;
revoke all on table public.ehs_personal_werk_bindings from anon, authenticated;

comment on table public.ehs_personal_werk_bindings is 'Server-managed immutable Werk binding for personal Google Play EHS subscriptions. One user/account may use personal module subscriptions in exactly one organization/Werk context.';
comment on column public.ehs_personal_werk_bindings.organization_id is 'Locked organization for personal subscription usage. End users cannot change this row; reset requires server/admin action.';
