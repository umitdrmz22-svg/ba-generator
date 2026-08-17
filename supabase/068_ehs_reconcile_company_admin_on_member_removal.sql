create or replace function public.ehs_sync_company_admin_from_werk_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user uuid;
  target_company uuid;
  best_role text;
  old_company uuid;
begin
  target_user := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  select company_id into target_company
  from public.ehs_werks
  where id = case when tg_op = 'DELETE' then old.werk_id else new.werk_id end;

  if target_company is not null and target_user is not null then
    select m.role into best_role
    from public.ehs_werk_members m
    join public.ehs_werks w on w.id = m.werk_id
    where w.company_id = target_company
      and m.user_id = target_user
      and m.status = 'active'
      and m.role in ('owner','admin')
    order by case m.role when 'owner' then 0 else 1 end
    limit 1;

    if best_role is not null then
      insert into public.ehs_company_admins(company_id,user_id,role,status)
      values(target_company,target_user,best_role,'active')
      on conflict(company_id,user_id) do update set
        role = excluded.role,
        status = 'active';
    else
      update public.ehs_company_admins
      set status = 'disabled'
      where company_id = target_company
        and user_id = target_user
        and role in ('owner','admin');
    end if;
  end if;

  if tg_op = 'UPDATE' and (old.werk_id is distinct from new.werk_id or old.user_id is distinct from new.user_id) then
    select company_id into old_company from public.ehs_werks where id = old.werk_id;
    if old_company is not null then
      select m.role into best_role
      from public.ehs_werk_members m
      join public.ehs_werks w on w.id = m.werk_id
      where w.company_id = old_company
        and m.user_id = old.user_id
        and m.status = 'active'
        and m.role in ('owner','admin')
      order by case m.role when 'owner' then 0 else 1 end
      limit 1;
      if best_role is not null then
        insert into public.ehs_company_admins(company_id,user_id,role,status)
        values(old_company,old.user_id,best_role,'active')
        on conflict(company_id,user_id) do update set role=excluded.role,status='active';
      else
        update public.ehs_company_admins
        set status='disabled'
        where company_id=old_company and user_id=old.user_id and role in ('owner','admin');
      end if;
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.ehs_sync_company_admin_from_werk_owner() from public, anon, authenticated;

drop trigger if exists trg_ehs_sync_company_admin_from_werk_owner on public.ehs_werk_members;
create trigger trg_ehs_sync_company_admin_from_werk_owner
after insert or update of werk_id, user_id, role, status or delete
on public.ehs_werk_members
for each row execute function public.ehs_sync_company_admin_from_werk_owner();