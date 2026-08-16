-- A company/organization may operate multiple Werke. Werk identity is unique by (organization_id, code), not by organization alone.
drop index if exists public.ehs_werks_one_operational_org;
