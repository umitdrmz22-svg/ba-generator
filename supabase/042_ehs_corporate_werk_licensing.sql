-- DefiDev EHS — corporate Werk licensing
-- Stand: 2026-08-16
-- Fixed net EUR pricing; each Werk includes 3 editor + 5 reader seats.
-- Applied live to EHS Management Studio as migration: ehs_corporate_werk_licensing.

begin;

create table if not exists public.ehs_corporate_prices (
  plan_code text primary key,
  module_count integer not null check (module_count between 0 and 6),
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  included_editors integer not null default 3 check (included_editors >= 0),
  included_readers integer not null default 5 check (included_readers >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.ehs_corporate_prices(plan_code,module_count,monthly_price_cents,included_editors,included_readers)
values
  ('werk_1_module',1,2490,3,5),
  ('werk_2_modules',2,4490,3,5),
  ('werk_3_modules',3,5990,3,5),
  ('werk_4_modules',4,6990,3,5),
  ('werk_5_modules',5,7490,3,5),
  ('werk_complete',6,7990,3,5),
  ('extra_editor',0,790,0,0),
  ('extra_reader',0,290,0,0)
on conflict (plan_code) do update set
  module_count=excluded.module_count,
  monthly_price_cents=excluded.monthly_price_cents,
  included_editors=excluded.included_editors,
  included_readers=excluded.included_readers,
  active=true,
  updated_at=now();

create table if not exists public.ehs_werks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  code text not null check (char_length(code) between 1 and 60),
  plan_code text not null references public.ehs_corporate_prices(plan_code),
  licensed_modules text[] not null default '{}',
  included_editor_seats integer not null default 3 check (included_editor_seats >= 0),
  included_reader_seats integer not null default 5 check (included_reader_seats >= 0),
  extra_editor_seats integer not null default 0 check (extra_editor_seats >= 0),
  extra_reader_seats integer not null default 0 check (extra_reader_seats >= 0),
  billing_status text not null default 'pending' check (billing_status in ('pending','active','grace','past_due','suspended','canceled','expired')),
  payment_source text not null default 'invoice' check (payment_source in ('invoice','contract','manual')),
  external_customer_ref text,
  external_subscription_ref text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  constraint ehs_werks_modules_allowed check (
    licensed_modules <@ array[
      'ehs_ba_monthly','ehs_fluchtplan_monthly','ehs_brandschutzordnung_monthly',
      'ehs_gefahrstoffkataster_monthly','ehs_dokumentmanagement_monthly','ehs_unfallmanagement_monthly'
    ]::text[]
  )
);

create table if not exists public.ehs_werk_members (
  werk_id uuid not null references public.ehs_werks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_type text not null check (seat_type in ('editor','reader')),
  role text not null check (role in ('owner','admin','editor','reader')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (werk_id,user_id),
  constraint ehs_werk_member_role_seat check (
    (role in ('owner','admin','editor') and seat_type='editor') or
    (role='reader' and seat_type='reader')
  )
);

create table if not exists public.ehs_werk_billing_events (
  id bigint generated always as identity primary key,
  werk_id uuid not null references public.ehs_werks(id) on delete cascade,
  event_type text not null check (event_type in ('created','activated','renewed','grace','past_due','suspended','canceled','expired','seat_change','module_change','payment_received')),
  amount_cents integer,
  currency text not null default 'EUR' check (currency='EUR'),
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.ehs_validate_werk_plan()
returns trigger language plpgsql as $$
declare
  expected_count integer;
  default_editors integer;
  default_readers integer;
  actual_count integer;
begin
  select module_count, included_editors, included_readers
    into expected_count, default_editors, default_readers
  from public.ehs_corporate_prices
  where plan_code=new.plan_code and active=true;
  if expected_count is null or expected_count=0 then raise exception 'INVALID_WERK_PLAN'; end if;
  select count(distinct value) into actual_count from unnest(new.licensed_modules) as value;
  if actual_count <> cardinality(new.licensed_modules) then raise exception 'DUPLICATE_MODULES_NOT_ALLOWED'; end if;
  if actual_count <> expected_count then raise exception 'MODULE_COUNT_DOES_NOT_MATCH_PLAN'; end if;
  if tg_op='INSERT' then
    new.included_editor_seats := default_editors;
    new.included_reader_seats := default_readers;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ehs_werks_plan_validation on public.ehs_werks;
create trigger ehs_werks_plan_validation
before insert or update of plan_code,licensed_modules on public.ehs_werks
for each row execute function public.ehs_validate_werk_plan();

create or replace function public.ehs_enforce_werk_seats()
returns trigger language plpgsql as $$
declare
  editor_limit integer;
  reader_limit integer;
  active_editors integer;
  active_readers integer;
begin
  if new.status <> 'active' then return new; end if;
  select included_editor_seats + extra_editor_seats, included_reader_seats + extra_reader_seats
    into editor_limit, reader_limit
  from public.ehs_werks where id=new.werk_id;
  if editor_limit is null then raise exception 'WERK_NOT_FOUND'; end if;
  select count(*) filter (where seat_type='editor' and status='active'),
         count(*) filter (where seat_type='reader' and status='active')
    into active_editors, active_readers
  from public.ehs_werk_members
  where werk_id=new.werk_id and user_id <> new.user_id;
  if new.seat_type='editor' and active_editors >= editor_limit then raise exception 'EDITOR_SEAT_LIMIT_REACHED'; end if;
  if new.seat_type='reader' and active_readers >= reader_limit then raise exception 'READER_SEAT_LIMIT_REACHED'; end if;
  return new;
end;
$$;

drop trigger if exists ehs_werk_members_seat_limit on public.ehs_werk_members;
create trigger ehs_werk_members_seat_limit
before insert or update of seat_type,status on public.ehs_werk_members
for each row execute function public.ehs_enforce_werk_seats();

alter table public.ehs_corporate_prices enable row level security;
alter table public.ehs_werks enable row level security;
alter table public.ehs_werk_members enable row level security;
alter table public.ehs_werk_billing_events enable row level security;

revoke all on public.ehs_corporate_prices from anon, authenticated;
revoke all on public.ehs_werks from anon, authenticated;
revoke all on public.ehs_werk_members from anon, authenticated;
revoke all on public.ehs_werk_billing_events from anon, authenticated;
revoke execute on function public.ehs_validate_werk_plan() from public, anon, authenticated;
revoke execute on function public.ehs_enforce_werk_seats() from public, anon, authenticated;

comment on table public.ehs_werks is 'Corporate DefiDev EHS license per physical Werk/site. Managed server-side; clients consume entitlements only.';
comment on table public.ehs_werk_members is 'Werk seat assignments; editor and reader quotas are enforced in Postgres.';
comment on table public.ehs_corporate_prices is 'Fixed DefiDev EHS corporate pricing catalogue in EUR cents, net before applicable VAT.';

commit;
