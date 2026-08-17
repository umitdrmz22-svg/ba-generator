create or replace function public.ehs_prevent_werk_seat_underflow()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  editor_count integer;
  reader_count integer;
begin
  select count(*) filter(where seat_type='editor' and status='active'),
         count(*) filter(where seat_type='reader' and status='active')
    into editor_count,reader_count
  from public.ehs_werk_members where werk_id=new.id;
  if editor_count > new.included_editor_seats + new.extra_editor_seats then raise exception 'EDITOR_SEAT_UNDERFLOW'; end if;
  if reader_count > new.included_reader_seats + new.extra_reader_seats then raise exception 'READER_SEAT_UNDERFLOW'; end if;
  return new;
end;
$$;

drop trigger if exists trg_ehs_prevent_werk_seat_underflow on public.ehs_werks;
create trigger trg_ehs_prevent_werk_seat_underflow
before update of included_editor_seats,included_reader_seats,extra_editor_seats,extra_reader_seats,plan_code
on public.ehs_werks
for each row execute function public.ehs_prevent_werk_seat_underflow();
