create or replace function public.ehs_guard_record_origin()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare actor uuid; old_origin uuid; new_origin uuid; row_org uuid; werk_org uuid; werk_name text; werk_code text; candidate uuid; candidate_count integer; authorized boolean;
begin
  actor:=auth.uid();
  old_origin:=nullif(to_jsonb(old)->>'origin_werk_id','')::uuid;
  new_origin:=nullif(to_jsonb(new)->>'origin_werk_id','')::uuid;
  row_org:=nullif(to_jsonb(new)->>'organization_id','')::uuid;

  if tg_op='UPDATE' then
    if old_origin is distinct from new_origin then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
    if (to_jsonb(old)->>'origin_werk_name') is distinct from (to_jsonb(new)->>'origin_werk_name') then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
    if (to_jsonb(old)->>'origin_werk_code') is distinct from (to_jsonb(new)->>'origin_werk_code') then raise exception 'EHS_ORIGIN_WERK_IMMUTABLE'; end if;
    return new;
  end if;

  if new_origin is null and actor is not null and row_org is not null then
    select werk_id into candidate from public.ehs_personal_werk_bindings where user_id=actor and organization_id=row_org;
    if candidate is null then
      select count(*),min(wm.werk_id::text)::uuid into candidate_count,candidate
      from public.ehs_werk_members wm join public.ehs_werks w on w.id=wm.werk_id
      where wm.user_id=actor and wm.status='active' and wm.seat_type='editor' and w.organization_id=row_org
        and w.billing_status in ('active','grace','canceled') and (w.current_period_end is null or w.current_period_end>now());
      if candidate_count<>1 then candidate:=null; end if;
    end if;
    if candidate is null then raise exception 'EHS_ORIGIN_WERK_CONTEXT_REQUIRED'; end if;
    new_origin:=candidate;
    new:=jsonb_populate_record(new,to_jsonb(new)||jsonb_build_object('origin_werk_id',new_origin));
  end if;

  if new_origin is not null then
    select organization_id,name,code into werk_org,werk_name,werk_code from public.ehs_werks where id=new_origin;
    if werk_org is null then raise exception 'EHS_ORIGIN_WERK_NOT_FOUND'; end if;
    if row_org is not null and werk_org<>row_org then raise exception 'EHS_ORIGIN_WERK_ORGANIZATION_MISMATCH'; end if;
    if actor is not null then
      select exists(
        select 1 from public.ehs_personal_werk_bindings b where b.user_id=actor and b.werk_id=new_origin
        union all
        select 1 from public.ehs_werk_members wm join public.ehs_werks w on w.id=wm.werk_id
          where wm.user_id=actor and wm.werk_id=new_origin and wm.status='active' and wm.seat_type='editor'
            and w.billing_status in ('active','grace','canceled') and (w.current_period_end is null or w.current_period_end>now())
      ) into authorized;
      if not authorized then raise exception 'EHS_ORIGIN_WERK_NOT_AUTHORIZED'; end if;
    end if;
    new:=jsonb_populate_record(new,to_jsonb(new)||jsonb_build_object('origin_werk_name',werk_name,'origin_werk_code',werk_code));
  end if;
  return new;
end; $$;
revoke all on function public.ehs_guard_record_origin() from public, anon, authenticated;
