REVOKE ALL ON FUNCTION public.assign_stabilization_codes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_stabilization_codes() FROM anon;
REVOKE ALL ON FUNCTION public.assign_stabilization_codes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_stabilization_codes() TO postgres;
GRANT EXECUTE ON FUNCTION public.assign_stabilization_codes() TO service_role;