-- Neutral Werk identity + immutable record origin. Network/IP/device are intentionally not part of licensing.
alter table public.ehs_personal_werk_bindings
  add column if not exists werk_id uuid references public.ehs_werks(id) on delete restrict;
alter table public.ehs_personal_werk_bindings alter column werk_id set not null;

create or replace function public.ehs_guard_personal_werk_binding()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare werk_org uuid;
begin
  select organization_id into werk_org from public.ehs_werks where id=new.werk_id;
  if werk_org is null then raise exception 'EHS_WERK_NOT_FOUND'; end if;
  if werk_org <> new.organization_id then raise exception 'EHS_WERK_ORGANIZATION_MISMATCH'; end if;
  if tg_op='UPDATE' and (old.werk_id is distinct from new.werk_id or old.organization_id is distinct from new.organization_id) then
    raise exception 'EHS_PERSONAL_WERK_BINDING_IMMUTABLE';
  end if;
  return new;
end; $$;
revoke all on function public.ehs_guard_personal_werk_binding() from public, anon, authenticated;
drop trigger if exists ehs_personal_werk_binding_guard on public.ehs_personal_werk_bindings;
create trigger ehs_personal_werk_binding_guard before insert or update on public.ehs_personal_werk_bindings
for each row execute function public.ehs_guard_personal_werk_binding();

-- A Werk can exist as a neutral origin identity before any corporate package is purchased.
alter table public.ehs_werks alter column plan_code drop not null;
create or replace function public.ehs_validate_werk_plan()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare expected_count integer; default_editors integer; default_readers integer; actual_count integer;
begin
  if new.plan_code is null then
    if cardinality(new.licensed_modules) <> 0 then raise exception 'UNLICENSED_WERK_CANNOT_HAVE_CORPORATE_MODULES'; end if;
    if tg_op='INSERT' then
      new.included_editor_seats:=0; new.included_reader_seats:=0;
      new.extra_editor_seats:=0; new.extra_reader_seats:=0;
    end if;
    new.updated_at:=now(); return new;
  end if;
  select module_count,included_editors,included_readers into expected_count,default_editors,default_readers
    from public.ehs_corporate_prices where plan_code=new.plan_code and active=true;
  if expected_count is null or expected_count=0 then raise exception 'INVALID_WERK_PLAN'; end if;
  select count(distinct value) into actual_count from unnest(new.licensed_modules) value;
  if actual_count<>cardinality(new.licensed_modules) then raise exception 'DUPLICATE_MODULES_NOT_ALLOWED'; end if;
  if actual_count<>expected_count then raise exception 'MODULE_COUNT_DOES_NOT_MATCH_PLAN'; end if;
  if tg_op='INSERT' or old.plan_code is distinct from new.plan_code then
    new.included_editor_seats:=default_editors; new.included_reader_seats:=default_readers;
  end if;
  new.updated_at:=now(); return new;
end; $$;

alter table public.documents add column if not exists origin_werk_id uuid references public.ehs_werks(id) on delete restrict;
alter table public.documents add column if not exists scope text not null default 'werk';
alter table public.documents drop constraint if exists documents_scope_check;
alter table public.documents add constraint documents_scope_check check (scope in ('werk','germany','international'));
alter table public.app_records add column if not exists origin_werk_id uuid references public.ehs_werks(id) on delete restrict;
alter table public.operating_instructions add column if not exists origin_werk_id uuid references public.ehs_werks(id) on delete restrict;
alter table public.hazardous_substances add column if not exists origin_werk_id uuid references public.ehs_werks(id) on delete restrict;
alter table public.incidents add column if not exists origin_werk_id uuid references public.ehs_werks(id) on delete restrict;

create index if not exists documents_origin_werk_idx on public.documents(origin_werk_id);
create index if not exists app_records_origin_werk_idx on public.app_records(origin_werk_id);
create index if not exists operating_instructions_origin_werk_idx on public.operating_instructions(origin_werk_id);
create index if not exists hazardous_substances_origin_werk_idx on public.hazardous_substances(origin_werk_id);
create index if not exists incidents_origin_werk_idx on public.incidents(origin_werk_id);

create or replace function public.ehs_guard_record_origin()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare old_origin uuid; new_origin uuid; row_org uuid; werk_org uuid;
begin
  old_origin:=nullif(to_jsonb(old)->>'origin_werk_id','')::uuid;
  new_origin:=nullif(to_jsonb(new)->>'origin_werk_id','')::uuid;
  row_org:=nullif(to_jsonb(new)->>'organization_id','')::uuid;
  if tg_op='UPDATE' and old_origin is distinct from new_origin then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
  if new_origin is not null then
    select organization_id into werk_org from public.ehs_werks where id=new_origin;
    if werk_org is null then raise exception 'EHS_ORIGIN_WERK_NOT_FOUND'; end if;
    if row_org is not null and werk_org<>row_org then raise exception 'EHS_ORIGIN_WERK_ORGANIZATION_MISMATCH'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.ehs_guard_record_origin() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['documents','app_records','operating_instructions','hazardous_substances','incidents'] loop
    execute format('drop trigger if exists ehs_record_origin_guard on public.%I',t);
    execute format('create trigger ehs_record_origin_guard before insert or update on public.%I for each row execute function public.ehs_guard_record_origin()',t);
  end loop;
end $$;
