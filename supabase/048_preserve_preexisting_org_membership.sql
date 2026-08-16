-- Preserve organization governance when corporate Werk membership is added/removed.
-- If a user already belonged to the organization, remember that prior role/status
-- and restore it when the Werk membership is removed. New corporate-only members
-- are removed from organization_members when their Werk membership is deleted.

alter table public.ehs_werk_members
  add column if not exists previous_org_role text,
  add column if not exists previous_org_status text;

create or replace function public.ehs_capture_werk_member_context()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  existing_role text;
  existing_status text;
begin
  if tg_op = 'UPDATE' then
    if new.werk_id is distinct from old.werk_id or new.user_id is distinct from old.user_id then
      raise exception 'WERK_MEMBER_IDENTITY_IMMUTABLE';
    end if;
    return new;
  end if;

  select organization_id into org_id from public.ehs_werks where id = new.werk_id;
  if org_id is null then raise exception 'WERK_ORGANIZATION_NOT_FOUND'; end if;

  select role, status into existing_role, existing_status
  from public.organization_members
  where organization_id = org_id and user_id = new.user_id;

  new.previous_org_role := existing_role;
  new.previous_org_status := existing_status;
  return new;
end;
$$;

drop trigger if exists ehs_werk_member_capture_context on public.ehs_werk_members;
create trigger ehs_werk_member_capture_context
before insert or update on public.ehs_werk_members
for each row execute function public.ehs_capture_werk_member_context();

create or replace function public.ehs_sync_werk_member_to_org()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  mapped_role text;
  mapped_status text;
begin
  select organization_id into org_id from public.ehs_werks where id = new.werk_id;
  if org_id is null then raise exception 'WERK_ORGANIZATION_NOT_FOUND'; end if;

  mapped_role := case new.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'editor' then 'ersteller'
    when 'reader' then 'leser'
    else 'leser'
  end;
  mapped_status := new.status;

  if new.previous_org_role in ('owner','admin') then
    mapped_role := new.previous_org_role;
    mapped_status := coalesce(new.previous_org_status, new.status);
  end if;

  insert into public.organization_members(organization_id,user_id,role,status)
  values(org_id,new.user_id,mapped_role,mapped_status)
  on conflict (organization_id,user_id) do update set
    role = excluded.role,
    status = excluded.status;

  return new;
end;
$$;

create or replace function public.ehs_remove_werk_member_from_org()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
begin
  select organization_id into org_id from public.ehs_werks where id = old.werk_id;
  if org_id is null then return old; end if;

  if old.previous_org_role is not null then
    insert into public.organization_members(organization_id,user_id,role,status)
    values(org_id, old.user_id, old.previous_org_role, coalesce(old.previous_org_status,'active'))
    on conflict (organization_id,user_id) do update set
      role = excluded.role,
      status = excluded.status;
  else
    delete from public.organization_members
    where organization_id = org_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;
