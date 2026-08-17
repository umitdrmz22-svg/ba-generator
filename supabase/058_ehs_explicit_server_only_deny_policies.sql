-- EHS corporate/licensing tables are intentionally server-managed via Edge Functions.
-- Keep an explicit RLS deny policy in addition to revoked grants so accidental grants
-- do not expose these tables to browser/mobile clients.

do $$
declare t text;
begin
  foreach t in array array[
    'ehs_companies','ehs_company_admins','ehs_company_audit_log','ehs_corporate_prices',
    'ehs_personal_werk_bindings','ehs_werk_billing_events','ehs_werk_invites','ehs_werk_members','ehs_werks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ehs_server_only_deny_all on public.%I', t);
    execute format('create policy ehs_server_only_deny_all on public.%I for all to anon, authenticated using (false) with check (false)', t);
  end loop;
end $$;
