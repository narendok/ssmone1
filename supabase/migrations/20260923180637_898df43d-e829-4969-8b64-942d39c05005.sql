REVOKE ALL ON FUNCTION public.phase8_can(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.phase8_assign_identifiers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase8_can(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.phase8_assign_identifiers() TO service_role;