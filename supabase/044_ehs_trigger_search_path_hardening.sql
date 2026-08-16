-- Harden EHS trigger functions against search_path manipulation.
-- Applied to production Supabase on 2026-08-16.

alter function public.ehs_validate_werk_plan() set search_path = public, pg_temp;
alter function public.ehs_enforce_werk_seats() set search_path = public, pg_temp;
alter function public.ehs_sync_werk_member_to_org() set search_path = public, pg_temp;
alter function public.ehs_remove_werk_member_from_org() set search_path = public, pg_temp;
