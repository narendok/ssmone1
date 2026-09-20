REVOKE EXECUTE ON FUNCTION public.create_phase7_ppap_package(uuid,uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_phase7_ppap_package(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_phase7_finished_goods_release(uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_phase7_dispatch(uuid,text,text,text,text,uuid[]) FROM anon;