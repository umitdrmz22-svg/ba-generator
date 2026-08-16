-- Fluchtplan / Brandschutzordnung generic records are shared Werk data.
-- Any editor-capable role in the Werk may update/delete; Leser remains read-only.

drop policy if exists app_records_update_owner_or_admin on public.app_records;
create policy app_records_update_owner_or_admin on public.app_records
for update to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
)
with check (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
);

drop policy if exists app_records_delete_owner_or_admin on public.app_records;
create policy app_records_delete_owner_or_admin on public.app_records
for delete to authenticated
using (
  public.has_org_role(organization_id, array['owner','admin','ersteller','pruefer','freigeber'])
);
