-- DefiDev EHS Platform — zentrale Google-Play-Abonnementberechtigung
-- Stand: 2026-08-16
-- Einmal im GEMEINSAMEN Supabase-Projekt ausführen.
-- Wichtig: Kaufstatus darf ausschließlich durch einen vertrauenswürdigen Server/
-- Edge Function nach Google-Play-Prüfung geschrieben werden. Clients erhalten
-- absichtlich KEINE INSERT-/UPDATE-/DELETE-Rechte auf diese Tabelle.

create table if not exists public.ehs_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google_play' check (provider in ('google_play')),
  product_id text not null default 'ehs_pro_monthly',
  base_plan_id text,
  package_name text not null,
  purchase_token text not null unique,
  status text not null check (status in ('pending','active','grace','paused','canceled','expired','revoked')),
  expires_at timestamptz,
  auto_renewing boolean not null default false,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ehs_subscription_product check (product_id = 'ehs_pro_monthly')
);

alter table public.ehs_subscriptions enable row level security;

-- No direct client policy is created. service_role bypasses RLS and is the only
-- role intended to write/read raw purchase tokens.
revoke all on table public.ehs_subscriptions from anon, authenticated;

create or replace function public.has_active_ehs_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ehs_subscriptions s
    where s.user_id = auth.uid()
      and s.product_id = 'ehs_pro_monthly'
      and s.status in ('active','grace')
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

create or replace function public.get_ehs_subscription_status()
returns table (
  product_id text,
  status text,
  expires_at timestamptz,
  auto_renewing boolean,
  last_verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.product_id, s.status, s.expires_at, s.auto_renewing, s.last_verified_at
  from public.ehs_subscriptions s
  where s.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.has_active_ehs_subscription() from public;
revoke all on function public.get_ehs_subscription_status() from public;
grant execute on function public.has_active_ehs_subscription() to authenticated;
grant execute on function public.get_ehs_subscription_status() to authenticated;

comment on table public.ehs_subscriptions is
  'Server-verified Google Play entitlement for the shared DefiDev EHS monthly subscription.';
comment on function public.has_active_ehs_subscription() is
  'Returns only whether the authenticated user currently has an active/grace EHS Pro entitlement.';
