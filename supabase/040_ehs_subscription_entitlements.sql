-- DefiDev EHS Platform — zentrale Google-Play-Abonnementberechtigung
-- Stand: 2026-08-16
-- Einmal im GEMEINSAMEN Supabase-Projekt ausführen.
-- Rohdaten des Google-Play-Kaufs (insb. purchase_token) bleiben ausschließlich
-- für vertrauenswürdige Server-/Edge-Function-Zugriffe bestimmt.

create table if not exists public.ehs_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google_play' check (provider in ('google_play')),
  product_id text not null default 'ehs_pro_monthly',
  base_plan_id text,
  package_name text not null,
  purchase_token text not null unique,
  status text not null check (status in ('pending','active','grace','on_hold','paused','canceled','expired','revoked')),
  expires_at timestamptz,
  auto_renewing boolean not null default false,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ehs_subscription_product check (product_id = 'ehs_pro_monthly')
);

-- Upgrade an already-created table safely when this script is rerun.
alter table public.ehs_subscriptions drop constraint if exists ehs_subscriptions_status_check;
alter table public.ehs_subscriptions
  add constraint ehs_subscriptions_status_check
  check (status in ('pending','active','grace','on_hold','paused','canceled','expired','revoked'));

alter table public.ehs_subscriptions enable row level security;

-- Remove legacy helper functions if they were created by an earlier draft.
drop function if exists public.has_active_ehs_subscription();
drop function if exists public.get_ehs_subscription_status();

-- No client may insert/update/delete entitlements or read sensitive purchase data.
revoke all on table public.ehs_subscriptions from anon, authenticated;

-- Authenticated users may read only their own non-sensitive entitlement columns.
drop policy if exists "ehs_subscription_read_own" on public.ehs_subscriptions;
create policy "ehs_subscription_read_own"
on public.ehs_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select (
  user_id,
  product_id,
  base_plan_id,
  status,
  expires_at,
  auto_renewing,
  last_verified_at
) on public.ehs_subscriptions to authenticated;

comment on table public.ehs_subscriptions is
  'Server-verified Google Play entitlement for the shared DefiDev EHS monthly subscription. Raw purchase tokens are not client-readable.';
comment on policy "ehs_subscription_read_own" on public.ehs_subscriptions is
  'Authenticated users can read only their own entitlement row; column grants exclude purchase token and package details.';
