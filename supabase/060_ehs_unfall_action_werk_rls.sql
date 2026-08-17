-- Actions inherit their Werk authorization from the linked incident, avoiding a second
-- independently mutable Werk field on the action itself.
drop policy if exists actions_member_read on public.actions;
create policy actions_member_read on public.actions for select to authenticated using (
  exists(select 1 from public.incidents i where i.id=actions.incident_id and i.organization_id=actions.organization_id and ((i.origin_werk_id is null and has_org_role(i.organization_id,array['owner','admin'])) or ehs_has_module_werk_access(i.organization_id,i.origin_werk_id,'ehs_unfallmanagement_monthly',false)))
);
drop policy if exists actions_editor_insert on public.actions;
create policy actions_editor_insert on public.actions for insert to authenticated with check (
  created_by=auth.uid() and incident_id is not null and exists(select 1 from public.incidents i where i.id=actions.incident_id and i.organization_id=actions.organization_id and ehs_has_module_werk_access(i.organization_id,i.origin_werk_id,'ehs_unfallmanagement_monthly',true))
);
drop policy if exists actions_editor_update on public.actions;
create policy actions_editor_update on public.actions for update to authenticated using (
  incident_id is not null and exists(select 1 from public.incidents i where i.id=actions.incident_id and i.organization_id=actions.organization_id and ehs_has_module_werk_access(i.organization_id,i.origin_werk_id,'ehs_unfallmanagement_monthly',true))
) with check (
  incident_id is not null and exists(select 1 from public.incidents i where i.id=actions.incident_id and i.organization_id=actions.organization_id and ehs_has_module_werk_access(i.organization_id,i.origin_werk_id,'ehs_unfallmanagement_monthly',true))
);
drop policy if exists actions_admin_delete on public.actions;
create policy actions_admin_delete on public.actions for delete to authenticated using (
  has_org_role(organization_id,array['owner','admin']) and incident_id is not null and exists(select 1 from public.incidents i where i.id=actions.incident_id and i.organization_id=actions.organization_id and (i.origin_werk_id is null or ehs_has_module_werk_access(i.organization_id,i.origin_werk_id,'ehs_unfallmanagement_monthly',true)))
);
drop policy if exists history_member_read on public.action_history;
create policy history_member_read on public.action_history for select to authenticated using (
  incident_id is not null and exists(select 1 from public.incidents i where i.id=action_history.incident_id and i.organization_id=action_history.organization_id and ((i.origin_werk_id is null and has_org_role(i.organization_id,array['owner','admin'])) or ehs_has_module_werk_access(i.organization_id,i.origin_werk_id,'ehs_unfallmanagement_monthly',false)))
);
