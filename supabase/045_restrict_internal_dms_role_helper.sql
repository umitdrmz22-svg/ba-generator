-- Keep the internal DMS role lookup callable by SECURITY DEFINER workflow functions,
-- but do not expose arbitrary organization-role lookups as a client RPC.
revoke execute on function public.dms_role_of(uuid, uuid) from authenticated;
