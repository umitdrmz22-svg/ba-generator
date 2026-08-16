do $$
declare t text;
begin
  foreach t in array array['documents','app_records','operating_instructions','hazardous_substances','incidents'] loop
    execute format('alter table public.%I add column if not exists origin_werk_name text',t);
    execute format('alter table public.%I add column if not exists origin_werk_code text',t);
  end loop;
end $$;

create or replace function public.ehs_guard_record_origin()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare old_origin uuid; new_origin uuid; row_org uuid; werk_org uuid; werk_name text; werk_code text;
begin
  old_origin:=nullif(to_jsonb(old)->>'origin_werk_id','')::uuid;
  new_origin:=nullif(to_jsonb(new)->>'origin_werk_id','')::uuid;
  row_org:=nullif(to_jsonb(new)->>'organization_id','')::uuid;
  if tg_op='UPDATE' then
    if old_origin is distinct from new_origin then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
    if (to_jsonb(old)->>'origin_werk_name') is distinct from (to_jsonb(new)->>'origin_werk_name') then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
    if (to_jsonb(old)->>'origin_werk_code') is distinct from (to_jsonb(new)->>'origin_werk_code') then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
  end if;
  if new_origin is not null then
    select organization_id,name,code into werk_org,werk_name,werk_code from public.ehs_werks where id=new_origin;
    if werk_org is null then raise exception 'EHS_ORIGIN_WERK_NOT_FOUND'; end if;
    if row_org is not null and werk_org<>row_org then raise exception 'EHS_ORIGIN_WERK_ORGANIZATION_MISMATCH'; end if;
    if tg_op='INSERT' then
      new:=jsonb_populate_record(new,to_jsonb(new)||jsonb_build_object('origin_werk_name',werk_name,'origin_werk_code',werk_code));
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.ehs_guard_record_origin() from public, anon, authenticated;
