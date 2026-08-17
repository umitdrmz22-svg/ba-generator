create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.has_org_role(org uuid, roles text[])
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and m.role=any(roles));
$$;
create or replace function private.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid() and m.status='active');
$$;
create or replace function private.ehs_has_module_werk_access(p_org uuid,p_werk uuid,p_product text,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();begin
  if actor is null or p_org is null or p_werk is null then return false; end if;
  if exists(select 1 from public.ehs_personal_werk_bindings b where b.user_id=actor and b.werk_id=p_werk and b.organization_id=p_org and exists(select 1 from public.ehs_subscriptions s where s.user_id=actor and s.status in ('active','grace','canceled') and (s.expires_at is null or s.expires_at>now()) and s.product_id in (p_product,'ehs_pro_monthly'))) then return true; end if;
  return exists(select 1 from public.ehs_werk_members wm join public.ehs_werks w on w.id=wm.werk_id where wm.user_id=actor and wm.werk_id=p_werk and wm.status='active' and (not p_write or wm.seat_type='editor') and w.organization_id=p_org and p_product=any(w.licensed_modules) and w.billing_status in ('active','grace','canceled') and (w.current_period_end is null or w.current_period_end>now()));
end$$;
create or replace function private.ehs_has_org_module_access(p_org uuid,p_product text,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();begin
  if actor is null or p_org is null then return false; end if;
  return exists(select 1 from public.ehs_personal_werk_bindings b where b.user_id=actor and b.organization_id=p_org and exists(select 1 from public.ehs_subscriptions s where s.user_id=actor and s.status in ('active','grace','canceled') and (s.expires_at is null or s.expires_at>now()) and s.product_id in (p_product,'ehs_pro_monthly')))
  or exists(select 1 from public.ehs_werk_members wm join public.ehs_werks w on w.id=wm.werk_id where wm.user_id=actor and wm.status='active' and (not p_write or wm.seat_type='editor') and w.organization_id=p_org and p_product=any(w.licensed_modules) and w.billing_status in ('active','grace','canceled') and (w.current_period_end is null or w.current_period_end>now()));
end$$;

revoke all on function private.has_org_role(uuid,text[]) from public;
revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.ehs_has_module_werk_access(uuid,uuid,text,boolean) from public;
revoke all on function private.ehs_has_org_module_access(uuid,text,boolean) from public;
grant execute on function private.has_org_role(uuid,text[]) to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.ehs_has_module_werk_access(uuid,uuid,text,boolean) to authenticated;
grant execute on function private.ehs_has_org_module_access(uuid,text,boolean) to authenticated;

create or replace function public.has_org_role(org uuid,roles text[])
returns boolean language sql stable security invoker set search_path=private,pg_temp as $$select private.has_org_role(org,roles)$$;
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security invoker set search_path=private,pg_temp as $$select private.is_org_member(org)$$;
create or replace function public.ehs_has_module_werk_access(p_org uuid,p_werk uuid,p_product text,p_write boolean default false)
returns boolean language sql stable security invoker set search_path=private,pg_temp as $$select private.ehs_has_module_werk_access(p_org,p_werk,p_product,p_write)$$;
create or replace function public.ehs_has_org_module_access(p_org uuid,p_product text,p_write boolean default false)
returns boolean language sql stable security invoker set search_path=private,pg_temp as $$select private.ehs_has_org_module_access(p_org,p_product,p_write)$$;

revoke execute on function public.has_org_role(uuid,text[]) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.ehs_has_module_werk_access(uuid,uuid,text,boolean) from anon;
revoke execute on function public.ehs_has_org_module_access(uuid,text,boolean) from anon;
grant execute on function public.has_org_role(uuid,text[]) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.ehs_has_module_werk_access(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.ehs_has_org_module_access(uuid,text,boolean) to authenticated;
