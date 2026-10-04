-- Execute only in egjotuxqguifnvdnflan, the unpublished synthetic acceptance copy.
-- SQL actor-context checks, not authenticated HTTP/JWT or Storage acceptance.
-- No identities, business rows or storage objects are inserted by this script.
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"service_role"}',true);
SELECT set_config('lifecycle.template_transition','outer-transition',true);
SELECT set_config('lifecycle.template_transition_target','outer-target',true);
DO $checks$
DECLARE
  actor uuid := '11111111-1111-4111-8111-111111111111';
  outsider uuid := '22222222-2222-4222-8222-222222222222';
  template uuid := '203ae4c9-5ff0-4ea6-8c26-b13650e0ac05';
  v_revision uuid := '74ac7ee9-0a48-4fe7-8cea-0cb517e8b854';
  args jsonb := jsonb_build_object('p_project_id','77777777-7777-4777-8777-777777777777',
    'p_template_key','LC-SYNTHETIC-REPORT','p_template_version',1,
    'p_template_document_revision_id',v_revision,'p_request_key','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  result jsonb;
  rendered text;
  checksum text;
  bytes bigint;
BEGIN
  result := public.execute_lifecycle_document_action(actor,'authorize_lifecycle_document_draft',args);
  IF result IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unexpected authorization result'; END IF;
  IF auth.role() <> 'service_role' OR auth.uid() <> actor
    OR current_setting('lifecycle.template_transition') <> 'outer-transition'
    OR current_setting('lifecycle.template_transition_target') <> 'outer-target' THEN
    RAISE EXCEPTION 'Transport leaked successful request context';
  END IF;
  BEGIN
    PERFORM public.execute_lifecycle_document_action(outsider,'authorize_lifecycle_document_draft',args);
    RAISE EXCEPTION 'Outsider unexpectedly authorized';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Not authorized' THEN RAISE; END IF;
  END;
  IF auth.role() <> 'service_role' OR auth.uid() <> actor
    OR current_setting('lifecycle.template_transition_target') <> 'outer-target' THEN
    RAISE EXCEPTION 'Transport leaked failed request context';
  END IF;
  BEGIN
    PERFORM public.execute_lifecycle_document_action(actor,'authorize_lifecycle_document_draft',
      args || jsonb_build_object('p_verified_actor_id',outsider));
    RAISE EXCEPTION 'Caller actor argument accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Lifecycle arguments do not match the protected operation' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.execute_lifecycle_document_action(actor,'authorize_lifecycle_document_draft',
      args || jsonb_build_object('p_template_document_revision_id','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'));
    RAISE EXCEPTION 'Unpinned revision accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Matching active immutable template version required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.execute_lifecycle_document_action(actor,'create_lifecycle_document_template_revision',
      jsonb_build_object('p_template_id',template,'p_content','Changed ACTIVE content'));
    RAISE EXCEPTION 'ACTIVE template content appended';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Only a DRAFT template may receive a new immutable content revision' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.department_process_template_document_revisions SET content='Changed immutable content' WHERE id=v_revision;
    RAISE EXCEPTION 'Immutable body updated';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Template document revisions are immutable' THEN RAISE; END IF;
  END;
  SELECT replace(replace(replace(replace(r.content,'{{ PROJECT_CODE }}',p.code),
    '{{PROJECT_NAME}}',p.name),'{{PROJECT_REVISION}}',p.revision),'{{DEPARTMENT}}',d.name)
  INTO rendered FROM public.department_process_template_document_revisions r
  JOIN public.department_process_templates t ON t.id=r.template_id
  JOIN public.projects p ON p.id='77777777-7777-4777-8777-777777777777'
  JOIN public.departments d ON d.id=p.department_id WHERE r.id=v_revision;
  checksum := encode(extensions.digest(convert_to(rendered,'UTF8'),'sha256'),'hex');
  bytes := octet_length(convert_to(rendered,'UTF8'));
  BEGIN
    PERFORM public.execute_lifecycle_document_action(actor,'register_lifecycle_document_storage_attempt',
      args || jsonb_build_object('p_storage_bucket','project-drive',
        'p_storage_path','77777777-7777-4777-8777-777777777777/ffffffff-ffff-4fff-8fff-ffffffffffff-draft.txt',
        'p_sha256_checksum',checksum,'p_size_bytes',bytes));
    RAISE EXCEPTION 'Nonexistent stored object registered';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Staged storage object does not exist' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.execute_lifecycle_document_action(actor,'commit_lifecycle_document_draft',
      args || jsonb_build_object('p_target_folder_id','99999999-9999-4999-8999-999999999999',
        'p_file_name','LCA-2026-001-LC-SYNTHETIC-REPORT-v1.txt','p_mime_type','text/plain',
        'p_storage_bucket','project-drive',
        'p_storage_path','77777777-7777-4777-8777-777777777777/ffffffff-ffff-4fff-8fff-ffffffffffff-draft.txt',
        'p_sha256_checksum',checksum,'p_size_bytes',bytes));
    RAISE EXCEPTION 'Draft committed without an owned storage attempt';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'Staged storage object lacks a verified owned attempt receipt' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.lifecycle_document_storage_attempts)
    OR EXISTS (SELECT 1 FROM public.project_lifecycle_document_drafts)
    OR EXISTS (SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'Rejected missing-object call left persistence';
  END IF;
  PERFORM set_config('lifecycle_test.managed_contract_checks','passed',true);
END;
$checks$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
DO $manager$
BEGIN
  IF (SELECT count(*) FROM public.department_process_template_document_revisions
      WHERE id='74ac7ee9-0a48-4fe7-8cea-0cb517e8b854') <> 1 THEN
    RAISE EXCEPTION 'Scoped manager cannot see saved body under RLS';
  END IF;
  BEGIN
    PERFORM public.execute_lifecycle_document_action('11111111-1111-4111-8111-111111111111',
      'retire_lifecycle_document_template','{"p_template_id":"203ae4c9-5ff0-4ea6-8c26-b13650e0ac05"}');
    RAISE EXCEPTION 'Authenticated browser role executed server-only transport';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('lifecycle_test.manager_rls','passed',true);
END;
$manager$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
DO $outsider$
BEGIN
  IF (SELECT count(*) FROM public.department_process_template_document_revisions
      WHERE id='74ac7ee9-0a48-4fe7-8cea-0cb517e8b854') <> 0 THEN
    RAISE EXCEPTION 'Outsider sees scoped saved body under RLS';
  END IF;
  PERFORM set_config('lifecycle_test.outsider_rls','passed',true);
END;
$outsider$;
RESET ROLE;
SELECT 'managed protected-contract checks' AS test,current_setting('lifecycle_test.managed_contract_checks') AS result
UNION ALL SELECT 'authenticated manager RLS and transport denial',current_setting('lifecycle_test.manager_rls')
UNION ALL SELECT 'authenticated outsider RLS denial',current_setting('lifecycle_test.outsider_rls');
ROLLBACK;
