create or replace function public.ehs_sync_company_admin_from_werk_owner()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare company uuid;
begin
  if new.status<>'active' or new.role not in ('owner','admin') then return new; end if;
  select company_id into company from public.ehs_werks where id=new.werk_id;
  if company is null then return new; end if;
  insert into public.ehs_company_admins(company_id,user_id,role,status)
  values(company,new.user_id,new.role,'active')
  on conflict(company_id,user_id) do update set
    role=case when public.ehs_company_admins.role='owner' then 'owner' else excluded.role end,
    status='active';
  return new;
end;
$$;

drop trigger if exists trg_ehs_sync_company_admin_from_werk_owner on public.ehs_werk_members;
create trigger trg_ehs_sync_company_admin_from_werk_owner
after insert or update of role,status on public.ehs_werk_members
for each row execute function public.ehs_sync_company_admin_from_werk_owner();
