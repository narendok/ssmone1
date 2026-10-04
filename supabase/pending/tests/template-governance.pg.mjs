import { after, afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Node test runner executes the actual SQL functions/trigger, not JS substitutes.
// The small dependency schema and permission predicates are TEST FIXTURES.
// This does not assert Supabase RLS, HTTP actor transport, Storage, migration
// replay, two-session concurrency or production acceptance.
const prior = readFileSync(new URL("../../migrations/20261002220916_5d158822-de77-479d-a8af-54037acc96ad.sql", import.meta.url), "utf8");
const pending = readFileSync(new URL("../20261003_lifecycle_document_draft_generation.sql", import.meta.url), "utf8");
const transport = readFileSync(new URL("../20261004_lifecycle_document_actor_transport.sql", import.meta.url), "utf8");
const managedTransitions = readFileSync(new URL("./managed-template-transition.fixture.sql", import.meta.url), "utf8");
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const actor = id(1), department = id(10), template = id(20), revision = id(21), earlier = id(22), project = id(30);
let db;

function statement(source, start, end = ";") {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0, `Missing actual SQL definition: ${start}`);
  const finish = source.indexOf(end, offset);
  assert.ok(finish >= 0, `Missing SQL terminator: ${start}`);
  return source.slice(offset, finish + end.length);
}
const routine = (source, name) => statement(source, `CREATE OR REPLACE FUNCTION public.${name}(`, "\n$$;");

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    SET search_path = public, extensions;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    CREATE TABLE storage.objects (bucket_id text, name text);
    CREATE TABLE public.departments (id uuid PRIMARY KEY);
    INSERT INTO public.departments VALUES ('${department}');
    CREATE TABLE public.company_process_stages (id uuid PRIMARY KEY, is_active boolean);
    CREATE TABLE public.department_process_template_stages
      (id uuid PRIMARY KEY, template_id uuid, source_company_process_stage_id uuid);
    CREATE TABLE public.projects (id uuid PRIMARY KEY, department_id uuid,
      project_drive_node_id uuid, revision text);
    INSERT INTO public.projects VALUES ('${project}', '${department}', '${id(31)}', 'TEST-01');
    CREATE FUNCTION public.can_access_department_drive(p_actor uuid, p_department uuid, p_project uuid)
      RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT p_actor = '${actor}'::uuid AND p_department = '${department}'::uuid
        AND (p_project IS NULL OR p_project = '${project}'::uuid) $$;
    CREATE FUNCTION public.lifecycle_can_manage_department(p_actor uuid, p_department uuid)
      RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT p_actor = '${actor}'::uuid AND p_department = '${department}'::uuid $$;
    ALTER TABLE public.departments ADD COLUMN code text DEFAULT 'HW', ADD COLUMN name text DEFAULT 'Hardware';
    ALTER TABLE public.projects ADD COLUMN code text DEFAULT 'OEM-TEST', ADD COLUMN name text DEFAULT 'Synthetic project';
    CREATE TABLE public.drive_nodes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.projects(id),
      department_id uuid REFERENCES public.departments(id), parent_id uuid REFERENCES public.drive_nodes(id),
      name text, slug text, node_type text, file_type text, mime_type text, file_size_bytes bigint,
      storage_bucket text, storage_path text, sha256_checksum text, current_version integer,
      is_locked boolean DEFAULT false, is_trashed boolean DEFAULT false, created_by uuid, metadata jsonb
    );
    INSERT INTO public.drive_nodes(id,project_id,department_id,node_type)
      VALUES ('${id(31)}','${project}','${department}','FOLDER');
    INSERT INTO public.drive_nodes(id,project_id,department_id,parent_id,node_type)
      VALUES ('${id(32)}','${project}','${department}','${id(31)}','FOLDER');
    CREATE TABLE public.drive_node_revisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), node_id uuid REFERENCES public.drive_nodes(id),
      version integer, file_size_bytes bigint, storage_path text, sha256_checksum text,
      change_summary text, uploaded_by uuid
    );
    CREATE TABLE public.document_control_registers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), drive_node_id uuid REFERENCES public.drive_nodes(id),
      department_id uuid, document_number text, title text, document_status text, controlled_version integer,
      created_by uuid, project_id uuid, source_revision_id uuid REFERENCES public.drive_node_revisions(id), approval_note text
    );
    CREATE TABLE public.activity_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid, module_key text, entity_type text,
      entity_id uuid, action text, summary text, after_data jsonb, reason text
    );
    -- Numbering is an explicit fixture; these tests do not establish the
    -- actual managed sequence, audit triggers, policies or Storage behavior.
    CREATE FUNCTION public.next_business_number(text,text,text) RETURNS text LANGUAGE sql AS $$ SELECT 'TEST-DOC-0001' $$;
  `);
  await db.exec(statement(prior, "CREATE TABLE public.department_process_templates ("));
  await db.exec(statement(pending, "CREATE TABLE public.department_process_template_document_revisions ("));
  await db.exec(statement(pending, "ALTER TABLE public.department_process_template_document_revisions\n  ADD CONSTRAINT"));
  await db.exec(statement(pending, "ALTER TABLE public.department_process_templates"));
  await db.exec(statement(pending, "CREATE TABLE public.lifecycle_document_storage_attempts ("));
  await db.exec(statement(pending, "CREATE TABLE public.project_lifecycle_document_drafts ("));
  for (const name of ["lifecycle_actor", "lifecycle_template_guard", "activate_department_process_template", "retire_department_process_template"]) {
    await db.exec(routine(prior, name));
  }
  await db.exec(statement(prior, "CREATE TRIGGER lifecycle_template_guard_trigger"));
  for (const name of ["lifecycle_document_template_revision_guard", "create_lifecycle_document_template_revision", "activate_lifecycle_document_template", "retire_lifecycle_document_template", "authorize_lifecycle_document_draft", "lifecycle_document_storage_attempt_guard", "register_lifecycle_document_storage_attempt", "lifecycle_document_draft_guard", "commit_lifecycle_document_draft", "find_lifecycle_document_draft_receipt", "can_discard_lifecycle_document_object"]) {
    await db.exec(routine(pending, name));
  }
  await db.exec(statement(pending, "CREATE TRIGGER lifecycle_document_template_revision_immutable"));
  await db.exec(statement(pending, "CREATE TRIGGER lifecycle_document_storage_attempt_immutable"));
  await db.exec(statement(pending, "CREATE TRIGGER lifecycle_document_draft_immutable"));
  await db.exec(transport);
});
after(async () => { if (db) await db.close(); });
beforeEach(async () => {
  await db.exec("BEGIN;");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [actor]);
  await db.query(`INSERT INTO public.department_process_templates(id,department_id,template_key,version,title,created_by)
    VALUES ($1,$2,'OEM-TRACKER',1,'OEM Tracker',$3)`, [template, department, actor]);
  await db.query(`INSERT INTO public.department_process_template_document_revisions
    (id,template_id,revision_number,content,content_sha256,created_by)
    VALUES ($1,$2,1,$3,encode(digest(convert_to($3,'UTF8'),'sha256'),'hex'),$4),
           ($5,$2,2,$6,encode(digest(convert_to($6,'UTF8'),'sha256'),'hex'),$4)`,
    [earlier, template, "Old {{PROJECT_NAME}}", actor, revision, "Approved {{PROJECT_CODE}} / {{PROJECT_REVISION}}"]);
  await db.query("INSERT INTO public.company_process_stages VALUES ($1,true)", [id(40)]);
  await db.query("INSERT INTO public.department_process_template_stages VALUES ($1,$2,$3)", [id(41), template, id(40)]);
});
afterEach(async () => { await db.exec("ROLLBACK;"); });

async function activate() {
  await db.query("SELECT public.activate_lifecycle_document_template($1,$2)", [template, revision]);
}

test("activation persists the approved body and passes the existing transition guard", async () => {
  await activate();
  const { rows: [row] } = await db.query("SELECT status,active_document_revision_id,activated_at FROM public.department_process_templates WHERE id=$1", [template]);
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.active_document_revision_id, revision);
  assert.ok(row.activated_at);
});

test("authorization accepts only the activated body, not another immutable draft", async () => {
  await activate();
  await db.query("SELECT public.authorize_lifecycle_document_draft($1,'OEM-TRACKER',1,$2,$3)", [project, revision, id(50)]);
  // Savepoint allows observing rejection without losing the fixture transaction.
  await db.exec("SAVEPOINT denied;");
  await assert.rejects(db.query("SELECT public.authorize_lifecycle_document_draft($1,'OEM-TRACKER',1,$2,$3)", [project, earlier, id(50)]), /Matching active immutable/);
  await db.exec("ROLLBACK TO denied;");
});

test("retirement uses the existing transition contract and preserves the content pin", async () => {
  await activate();
  await db.query("SELECT public.retire_lifecycle_document_template($1)", [template]);
  const { rows: [row] } = await db.query("SELECT status,active_document_revision_id,retired_at FROM public.department_process_templates WHERE id=$1", [template]);
  assert.equal(row.status, "RETIRED");
  assert.equal(row.active_document_revision_id, revision);
  assert.ok(row.retired_at);
});

test("failed governed-stage validation rolls back activation and its document binding", async () => {
  await db.query("UPDATE public.company_process_stages SET is_active=false WHERE id=$1", [id(40)]);
  await db.exec("SAVEPOINT rejected_activation;");
  await assert.rejects(activate(), /active company process stage/);
  await db.exec("ROLLBACK TO rejected_activation;");
  const { rows: [row] } = await db.query("SELECT status,active_document_revision_id FROM public.department_process_templates WHERE id=$1", [template]);
  assert.equal(row.status, "DRAFT");
  assert.equal(row.active_document_revision_id, null);
});

test("cross-template revision cannot be activated", async () => {
  await db.query("INSERT INTO public.department_process_templates(id,department_id,template_key,version,title,created_by) VALUES ($1,$2,'OTHER',1,'Other',$3)", [id(60), department, actor]);
  await db.query("INSERT INTO public.department_process_template_document_revisions(id,template_id,revision_number,content,content_sha256,created_by) VALUES ($1,$2,1,'Other',encode(digest('Other','sha256'),'hex'),$3)", [id(61), id(60), actor]);
  await assert.rejects(db.query("SELECT public.activate_lifecycle_document_template($1,$2)", [template, id(61)]), /pinned immutable/);
});

test("malformed and unsupported fields cannot be approved", async () => {
  for (const content of ["{{project_name}}", "{{CLIENT_SECRET}}"]) {
    await db.exec("SAVEPOINT invalid_content;");
    const { rows: [row] } = await db.query("SELECT * FROM public.create_lifecycle_document_template_revision($1,$2)", [template, content]);
    await assert.rejects(db.query("SELECT public.activate_lifecycle_document_template($1,$2)", [template, row.id]), /document template/);
    await db.exec("ROLLBACK TO invalid_content;");
  }
});

test("actual append routine preserves whitespace and immutable content checksum", async () => {
  const content = "  OEM {{PROJECT_NAME}}\n";
  const { rows: [receipt] } = await db.query("SELECT * FROM public.create_lifecycle_document_template_revision($1,$2)", [template, content]);
  const { rows: [row] } = await db.query("SELECT content, content_sha256 FROM public.department_process_template_document_revisions WHERE id=$1", [receipt.id]);
  assert.equal(row.content, content);
  assert.equal(row.content_sha256, receipt.content_sha256);
  assert.equal(receipt.revision_number, 3);
});

test("fixture permission denial rejects activation before binding a revision", async () => {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id(99)]);
  await assert.rejects(activate(), /Not authorized/);
});

test("legacy active process templates with no approved body cannot generate documents", async () => {
  await db.query("SELECT public.activate_department_process_template($1)", [template]);
  await assert.rejects(db.query("SELECT public.authorize_lifecycle_document_draft($1,'OEM-TRACKER',1,$2,$3)", [project, revision, id(50)]), /Matching active immutable/);
});

test("active templates cannot receive another content revision", async () => {
  await activate();
  await assert.rejects(db.query("SELECT * FROM public.create_lifecycle_document_template_revision($1,$2)", [template, "New body"]), /Only a DRAFT template/);
});

test("immutable content cannot be overwritten even inside a privileged fixture", async () => {
  await assert.rejects(db.query("UPDATE public.department_process_template_document_revisions SET content='Changed' WHERE id=$1", [revision]), /immutable/);
});

async function asTrustedServer() {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','service_role',true), set_config('request.jwt.claims',$2,true)",
    [id(90), JSON.stringify({ sub: id(90), role: "service_role", trace: "original" })]);
  await db.exec("SET LOCAL ROLE service_role;");
}
async function invoke(operation, args, verifiedActor = actor) {
  return db.query("SELECT public.execute_lifecycle_document_action($1,$2,$3::jsonb) result", [verifiedActor, operation, JSON.stringify(args)]);
}

test("service-only append derives actual row provenance from the verified user", async () => {
  await asTrustedServer();
  const { rows: [response] } = await invoke("create_lifecycle_document_template_revision", { p_template_id: template, p_content: "Transport {{PROJECT_NAME}}" });
  assert.equal(response.result.length, 1);
  await db.exec("RESET ROLE;");
  const { rows: [row] } = await db.query("SELECT created_by,content FROM public.department_process_template_document_revisions WHERE id=$1", [response.result[0].id]);
  assert.equal(row.created_by, actor);
  assert.equal(row.content, "Transport {{PROJECT_NAME}}");
});

test("transport restores original claims and transition context after activation", async () => {
  await asTrustedServer();
  await invoke("activate_lifecycle_document_template", { p_template_id: template, p_template_document_revision_id: revision });
  await db.exec("RESET ROLE;");
  const { rows: [row] } = await db.query("SELECT auth.uid() actor, auth.role() role, current_setting('request.jwt.claims') claims, current_setting('lifecycle.template_transition',true) transition");
  assert.equal(row.actor, id(90));
  assert.equal(row.role, "service_role");
  assert.deepEqual(JSON.parse(row.claims), { sub: id(90), role: "service_role", trace: "original" });
  assert.ok(!row.transition || row.transition !== "on");
});

test("transport restores the transition-target flag used by the actual managed guard", async () => {
  // These helper/guard definitions were captured from the isolated managed
  // backend. Its target flag differs from the older migration fixture above.
  // Department permission predicates remain limited test fixtures.
  await db.exec(managedTransitions);
  await db.query("SELECT set_config('request.jwt.claim.role','service_role',true)");
  await db.query("SELECT set_config('lifecycle.template_transition_target','outer-template-target',true)");
  await db.query("SELECT public.execute_lifecycle_document_action($1,'activate_lifecycle_document_template',$2::jsonb)",
    [actor, JSON.stringify({ p_template_id: template, p_template_document_revision_id: revision })]);
  const { rows: [row] } = await db.query("SELECT current_setting('lifecycle.template_transition_target',true) AS target");
  assert.equal(row.target, "outer-template-target");
  const { rows: [stored] } = await db.query("SELECT status,active_document_revision_id FROM public.department_process_templates WHERE id=$1", [template]);
  assert.equal(stored.status, "ACTIVE");
  assert.equal(stored.active_document_revision_id, revision);
});

test("ordinary database roles cannot execute the transport, even with a spoofed claim", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("SAVEPOINT browser_denial;");
    await db.query("SELECT set_config('request.jwt.claim.role','service_role',true)");
    await db.exec(`SET LOCAL ROLE ${role};`);
    await assert.rejects(invoke("retire_lifecycle_document_template", { p_template_id: template }), /permission denied for function/);
    await db.exec("ROLLBACK TO browser_denial;");
  }
});

test("transport does not elevate an out-of-scope verified actor", async () => {
  await asTrustedServer();
  await assert.rejects(invoke("activate_lifecycle_document_template", { p_template_id: template, p_template_document_revision_id: revision }, id(99)), /Not authorized/);
});

test("transport rejects missing identity, extra actor overrides and unlisted operations", async () => {
  await asTrustedServer();
  const cases = [
    ["retire_lifecycle_document_template", { p_template_id: template }, null, /Verified actor/],
    ["retire_lifecycle_document_template", { p_template_id: template, p_verified_actor_id: id(99) }, actor, /arguments do not match/],
    ["retire_lifecycle_document_template", {}, actor, /arguments do not match/],
    ["unrelated_admin_rpc", {}, actor, /Unsupported/],
  ];
  for (const [operation, args, verifiedActor, error] of cases) {
    await db.exec("SAVEPOINT invalid_transport;");
    await assert.rejects(invoke(operation, args, verifiedActor), error);
    await db.exec("ROLLBACK TO invalid_transport;");
  }
});

test("trusted role is required in addition to EXECUTE privilege", async () => {
  await db.query("SELECT set_config('request.jwt.claim.role','authenticated',true)");
  await assert.rejects(invoke("retire_lifecycle_document_template", { p_template_id: template }), /trusted server role/);
});

test("storage registration through transport returns a scalar UUID and verified actor", async () => {
  await activate();
  const path = `${project}/${id(70)}-draft.txt`;
  await db.query("INSERT INTO storage.objects VALUES ('project-drive',$1)", [path]);
  await asTrustedServer();
  const { rows: [response] } = await invoke("register_lifecycle_document_storage_attempt", {
    p_project_id: project, p_template_key: "OEM-TRACKER", p_template_version: 1,
    p_template_document_revision_id: revision, p_request_key: id(50), p_storage_bucket: "project-drive",
    p_storage_path: path, p_sha256_checksum: "a".repeat(64), p_size_bytes: 10,
  });
  assert.match(response.result, /^[a-f0-9-]{36}$/);
  await db.exec("RESET ROLE;");
  const { rows: [row] } = await db.query("SELECT uploaded_by FROM public.lifecycle_document_storage_attempts WHERE id=$1", [response.result]);
  assert.equal(row.uploaded_by, actor);
});

async function preparedCommit() {
  await activate();
  const path = `${project}/${id(71)}-draft.txt`;
  const { rows: [metadata] } = await db.query("SELECT encode(extensions.digest(convert_to($1,'UTF8'),'sha256'),'hex') checksum, octet_length(convert_to($1,'UTF8')) bytes",
    ["Approved OEM-TEST / TEST-01"]);
  // Fake Storage metadata exists ONLY in this embedded test dependency schema.
  // Real managed acceptance requires a physically uploaded/downloaded object.
  await db.query("INSERT INTO storage.objects VALUES ('project-drive',$1)", [path]);
  await db.query("SELECT public.register_lifecycle_document_storage_attempt($1,'OEM-TRACKER',1,$2,$3,'project-drive',$4,$5,$6)",
    [project, revision, id(50), path, metadata.checksum, metadata.bytes]);
  return [project, id(32), id(50), "OEM-TRACKER", 1, revision, "OEM-TEST-OEM-TRACKER-v1.txt",
    "text/plain", "project-drive", path, metadata.checksum, metadata.bytes];
}
const commitDraft = (args) => db.query("SELECT * FROM public.commit_lifecycle_document_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", args);
async function rejectCommit(args, error) {
  await db.exec("SAVEPOINT rejected_commit;");
  await assert.rejects(commitDraft(args), error);
  await db.exec("ROLLBACK TO rejected_commit;");
}

test("actual SQL commit persists linked Drive revision, DRAFT register, audit and owned receipt", async () => {
  const args = await preparedCommit();
  const { rows: [receipt] } = await commitDraft(args);
  assert.equal(receipt.uses_staged_object, true);
  const { rows: [stored] } = await db.query(`SELECT node.created_by, revision.version,
    register.document_status, register.document_number, audit.actor_user_id,
    attempt.consumed_by_receipt_id=draft.id AS consumed
    FROM public.project_lifecycle_document_drafts draft
    JOIN public.drive_nodes node ON node.id=draft.generated_drive_node_id
    JOIN public.drive_node_revisions revision ON revision.id=draft.generated_revision_id
    JOIN public.document_control_registers register ON register.id=draft.document_control_register_id
    JOIN public.activity_log audit ON audit.id=draft.audit_event_id
    JOIN public.lifecycle_document_storage_attempts attempt ON attempt.consumed_by_receipt_id=draft.id
    WHERE draft.request_key=$1`, [id(50)]);
  assert.equal(stored.created_by, actor);
  assert.equal(stored.actor_user_id, actor);
  assert.equal(stored.version, 1);
  assert.equal(stored.document_status, "DRAFT");
  assert.equal(stored.document_number, "TEST-DOC-0001");
  assert.equal(stored.consumed, true);
});

test("identical replay with a second staging path reuses the canonical receipt", async () => {
  const args = await preparedCommit();
  const { rows: [first] } = await commitDraft(args);
  const { rows: [replay] } = await commitDraft(args.with(9, `${project}/${id(72)}-draft.txt`));
  assert.equal(replay.node_id, first.node_id);
  assert.equal(replay.uses_staged_object, false);
  const { rows: [count] } = await db.query("SELECT count(*) total FROM public.project_lifecycle_document_drafts");
  assert.equal(Number(count.total), 1);
});

test("same-key replay rejects changed MIME, checksum and size before returning a receipt", async () => {
  const args = await preparedCommit();
  await commitDraft(args);
  await rejectCommit(args.with(7, "application/pdf"), /Invalid document draft payload/);
  await rejectCommit(args.with(10, "0".repeat(64)), /server-rendered immutable template snapshot/);
  await rejectCommit(args.with(11, Number(args[11]) + 1), /server-rendered immutable template snapshot/);
});

test("same-key replay rejects changed project data even with newly rendered metadata", async () => {
  const args = await preparedCommit();
  await commitDraft(args);
  await db.query("UPDATE public.projects SET code='OEM-CHANGED' WHERE id=$1", [project]);
  await rejectCommit(args, /server-rendered immutable template snapshot/);
  const { rows: [metadata] } = await db.query("SELECT encode(extensions.digest(convert_to($1,'UTF8'),'sha256'),'hex') checksum, octet_length(convert_to($1,'UTF8')) bytes",
    ["Approved OEM-CHANGED / TEST-01"]);
  await rejectCommit(args.with(6, "OEM-CHANGED-OEM-TRACKER-v1.txt").with(10, metadata.checksum).with(11, metadata.bytes),
    /Request key conflicts with a different document draft payload/);
});

test("an audit insertion failure rolls back Drive, revision, register and receipt together", async () => {
  const args = await preparedCommit();
  await db.exec(`CREATE FUNCTION public.fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'Fixture audit failure'; END; $$;
    CREATE TRIGGER fixture_reject_audit BEFORE INSERT ON public.activity_log
      FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_audit();`);
  await rejectCommit(args, /Fixture audit failure/);
  const { rows: [remaining] } = await db.query(`SELECT
    (SELECT count(*) FROM public.drive_nodes WHERE node_type='FILE') files,
    (SELECT count(*) FROM public.drive_node_revisions) revisions,
    (SELECT count(*) FROM public.document_control_registers) registers,
    (SELECT count(*) FROM public.project_lifecycle_document_drafts) receipts,
    (SELECT count(*) FROM public.lifecycle_document_storage_attempts WHERE consumed_at IS NOT NULL) consumed`);
  for (const value of Object.values(remaining)) assert.equal(Number(value), 0);
});
