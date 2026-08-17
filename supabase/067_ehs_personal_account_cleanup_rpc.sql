-- Service-only cleanup used by delete-my-account.
-- Exclusive personal organizations may be removed; shared/corporate organizations are preserved.

create or replace function public.ehs_cleanup_personal_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  rec record;
  deleted_orgs int := 0;
  detached_bindings int := 0;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  for rec in
    select distinct b.organization_id, b.werk_id
    from public.ehs_personal_werk_bindings b
    where b.user_id = p_user_id
  loop
    if exists (
      select 1 from public.ehs_companies c
      where c.organization_id = rec.organization_id
    ) or exists (
      select 1 from public.organization_members m
      where m.organization_id = rec.organization_id
        and m.user_id <> p_user_id
    ) or exists (
      select 1 from public.ehs_personal_werk_bindings b2
      where b2.organization_id = rec.organization_id
        and b2.user_id <> p_user_id
    ) or not exists (
      select 1 from public.organizations o
      where o.id = rec.organization_id
        and o.created_by = p_user_id
    ) then
      delete from public.ehs_personal_werk_bindings
      where user_id = p_user_id
        and organization_id = rec.organization_id;
      detached_bindings := detached_bindings + 1;
      continue;
    end if;

    delete from public.app_records where organization_id = rec.organization_id;
    delete from public.documents where organization_id = rec.organization_id;
    delete from public.hazardous_substances where organization_id = rec.organization_id;
    delete from public.incidents where organization_id = rec.organization_id;
    delete from public.operating_instructions where organization_id = rec.organization_id;
    delete from public.ehs_personal_werk_bindings where organization_id = rec.organization_id;
    delete from public.organizations where id = rec.organization_id;

    if found then
      deleted_orgs := deleted_orgs + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'deletedPersonalOrganizations', deleted_orgs,
    'detachedPersonalBindings', detached_bindings,
    'corporateRecordsPreserved', true
  );
end;
$$;

revoke all on function public.ehs_cleanup_personal_account_data(uuid) from public, anon, authenticated;
grant execute on function public.ehs_cleanup_personal_account_data(uuid) to service_role;
