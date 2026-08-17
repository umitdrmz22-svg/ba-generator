do $$
declare t text;
begin
  foreach t in array array['ehs_subscriptions','email_logs','app_settings','ba_documents'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('drop policy if exists ehs_server_only_deny_all on public.%I',t);
    execute format('create policy ehs_server_only_deny_all on public.%I for all to anon, authenticated using (false) with check (false)',t);
  end loop;
end$$;
