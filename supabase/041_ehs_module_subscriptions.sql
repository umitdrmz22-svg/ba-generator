-- DefiDev EHS — separate monthly entitlement per module
-- Stand: 2026-08-16
-- Applied to the shared EHS Supabase project as migration: ehs_module_subscriptions.
-- ehs_pro_monthly remains accepted only as a legacy all-access entitlement.

begin;

alter table public.ehs_subscriptions
  drop constraint if exists ehs_subscription_product;

alter table public.ehs_subscriptions
  drop constraint if exists ehs_subscriptions_pkey;

alter table public.ehs_subscriptions
  alter column product_id drop default;

alter table public.ehs_subscriptions
  add constraint ehs_subscription_product
  check (product_id in (
    'ehs_ba_monthly',
    'ehs_fluchtplan_monthly',
    'ehs_brandschutzordnung_monthly',
    'ehs_gefahrstoffkataster_monthly',
    'ehs_dokumentmanagement_monthly',
    'ehs_unfallmanagement_monthly',
    'ehs_pro_monthly'
  ));

alter table public.ehs_subscriptions
  add constraint ehs_subscriptions_pkey primary key (user_id, product_id);

comment on table public.ehs_subscriptions is
  'Server-verified Google Play entitlements for DefiDev EHS module subscriptions. One user can hold multiple module subscriptions. Raw purchase tokens are not client-readable. ehs_pro_monthly is legacy all-access only.';

comment on policy "ehs_subscription_read_own" on public.ehs_subscriptions is
  'Authenticated users can read only their own module entitlement rows; column grants exclude purchase token and package details.';

commit;
