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
    CREATE EXTENSION pgcrypto;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
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
  `);
  await db.exec(statement(prior, "CREATE TABLE public.department_process_templates ("));
  await db.exec(statement(pending, "CREATE TABLE public.department_process_template_document_revisions ("));
  await db.exec(statement(pending, "ALTER TABLE public.department_process_template_document_revisions\n  ADD CONSTRAINT"));
  await db.exec(statement(pending, "ALTER TABLE public.department_process_templates"));
  for (const name of ["lifecycle_actor", "lifecycle_template_guard", "activate_department_process_template", "retire_department_process_template"]) {
    await db.exec(routine(prior, name));
  }
  await db.exec(statement(prior, "CREATE TRIGGER lifecycle_template_guard_trigger"));
  for (const name of ["lifecycle_document_template_revision_guard", "create_lifecycle_document_template_revision", "activate_lifecycle_document_template", "retire_lifecycle_document_template", "authorize_lifecycle_document_draft"]) {
    await db.exec(routine(pending, name));
  }
  await db.exec(statement(pending, "CREATE TRIGGER lifecycle_document_template_revision_immutable"));
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
