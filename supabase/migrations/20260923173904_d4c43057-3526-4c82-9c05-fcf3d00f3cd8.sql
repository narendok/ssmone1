BEGIN;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_application_status(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(text,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(text,text,text,text,text,text,text,text,text,bigint) TO anon;
COMMIT;