-- Corporate Werk reader seats are read-only across all EHS module data.
-- Corporate editors are synced to organization role "ersteller"; readers to "leser".

-- Generic app records (Fluchtplan / Brandschutzordnung and other generic module records)
drop policy if exists app_records_insert_owner on public.app_records;
create policy app_records_insert_owner on public.app_records
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and updated_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
);

drop policy if exists app_records_update_owner_or_admin on public.app_records;
create policy app_records_update_owner_or_admin on public.app_records
for update to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
  and (owner_user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']))
)
with check (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
  and (owner_user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']))
);

drop policy if exists app_records_delete_owner_or_admin on public.app_records;
create policy app_records_delete_owner_or_admin on public.app_records
for delete to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
  and (owner_user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']))
);

-- Unfallmanagement incidents: readers may select, but may not create or update.
drop policy if exists incidents_member_insert on public.incidents;
create policy incidents_member_insert on public.incidents
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
);

drop policy if exists incidents_editor_update on public.incidents;
create policy incidents_editor_update on public.incidents
for update to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
  and (created_by = auth.uid() or public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer']))
)
with check (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
);

-- Existing actions created before a role downgrade must also become read-only.
drop policy if exists actions_editor_update on public.actions;
create policy actions_editor_update on public.actions
for update to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
  and (created_by = auth.uid() or public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber']))
)
with check (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
);
