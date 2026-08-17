create or replace function public.ehs_enforce_invite_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  editor_limit integer;
  reader_limit integer;
  active_count integer;
  pending_count integer;
  werk_company uuid;
  werk_billing text;
  werk_period_end timestamptz;
  seat_limit integer;
begin
  if new.status <> 'pending' then
    new.updated_at := now();
    return new;
  end if;

  select company_id,
         billing_status,
         current_period_end,
         included_editor_seats + extra_editor_seats,
         included_reader_seats + extra_reader_seats
    into werk_company, werk_billing, werk_period_end, editor_limit, reader_limit
  from public.ehs_werks
  where id = new.werk_id
  for update;

  if werk_company is null then raise exception 'WERK_NOT_FOUND'; end if;
  if werk_company is distinct from new.company_id then raise exception 'INVITE_COMPANY_WERK_MISMATCH'; end if;
  if werk_billing not in ('active','grace') or (werk_period_end is not null and werk_period_end <= now()) then
    raise exception 'WERK_LICENSE_INACTIVE';
  end if;

  seat_limit := case when new.seat_type='editor' then editor_limit else reader_limit end;
  if seat_limit is null or seat_limit <= 0 then raise exception 'SEAT_LIMIT_REACHED'; end if;

  select count(*) into active_count
  from public.ehs_werk_members
  where werk_id=new.werk_id and seat_type=new.seat_type and status='active';

  select count(*) into pending_count
  from public.ehs_werk_invites
  where werk_id=new.werk_id
    and seat_type=new.seat_type
    and status='pending'
    and expires_at > now()
    and id is distinct from new.id;

  if active_count + pending_count >= seat_limit then
    raise exception 'SEAT_LIMIT_REACHED';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ehs_enforce_invite_capacity on public.ehs_werk_invites;
create trigger trg_ehs_enforce_invite_capacity
before insert or update of werk_id,company_id,seat_type,status,expires_at
on public.ehs_werk_invites
for each row execute function public.ehs_enforce_invite_capacity();
