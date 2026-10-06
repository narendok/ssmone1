# Sales Read Compatibility — Exact Facade Export (2026-10-06 UTC)

Status: **source-only repair**. No database SQL, data, grant, user, fixture, generation, or publication change was made.

## Observed deployed schema

The read-only catalog query returned only these `public.requirement_feasibility_reviews` columns:

```text
id, requirement_id, department_id, reviewer_user_id, status, findings,
assumptions, risks, reviewed_at, created_by, created_at, updated_at
```

The pending provenance fields (`source_revision_id`, `source_revision_number`, `master_specification_version_id`, `master_specification_version_number`, `applicable_workstreams`) are absent. The main Sales overview must not select them.

## Exact deployed-safe review facade

```ts
sb.from("requirement_feasibility_reviews")
  .select("id,requirement_id,department_id,reviewer_user_id,status,findings,assumptions,risks,reviewed_at,created_at,requirement:customer_requirements(id,requirement_number,title,current_revision),department:departments(id,name,code)")
  .order("created_at", { ascending: false });
```

```ts
export function withUnavailableFeasibilityProvenance(reviews, error = "Immutable feasibility provenance is unavailable in the deployed read model; readiness is blocked until the protected provenance contract is accepted.") {
  return {
    reviews: reviews.map((review) => ({ ...review, source_revision_id: null, source_revision_number: null, master_specification_version_id: null, master_specification_version_number: null, applicable_workstreams: null })),
    provenance: { available: false, error },
  };
}
```

The primary Sales result remains intact. Feasibility and baseline readiness continue fail-closed through their existing `SOURCE_ERROR` path, so missing provenance cannot be read as empty data or a passed gate.

## Regression coverage

`src/lib/sales.test.ts` asserts retained deployed review records with unavailable provenance. `src/lib/feasibility-planning.test.ts` asserts a partial provenance-source failure remains `SOURCE_ERROR` and disabled.