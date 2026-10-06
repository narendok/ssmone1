# Controlled Requirement Source Binding — Review Export (2026-10-06 UTC)

Status: **pending source only**. This document describes the exact missing protected database dependency; it is not deployed SQL and does not authorize any write.

## Implemented user interface behavior

- The Sales Requirement action opens one controlled form.
- Selecting an opportunity displays its RLS-visible customer and the matching Master Specification number and immutable revision.
- A failed Sales source read is displayed as an error with a retry action; it is never presented as an empty or successful source result.
- The form stays disabled. It does not call the legacy direct `createCustomerRequirement` write path.
- No requirement, revision, activity, opportunity stage, Master Specification, customer, or user record is created or modified by this user interface.

## Exact pending database dependency

A single protected, caller-authenticated atomic routine is required before source-bound creation can be enabled. The routine must accept only:

```text
opportunity_id UUID
customer_id UUID
master_specification_version_id UUID
title TEXT
customer_reference TEXT NULL
summary TEXT NULL
request_key UUID
```

Within one transaction, it must verify the authoritative opportunity/customer pair and Master Specification version; persist the immutable version with the header and revision 1; create the header, revision, audit, and request-key receipt atomically; canonicalize replay payloads; reject mismatches, conflicts, and direct writes; and roll back every inserted row if any later step fails.

## Acceptance required before deployment

- Caller-authenticated Sales authorization and denial tests, including non-admin RLS evidence.
- Opportunity/customer mismatch, Master version mismatch, and unavailable-version denial tests.
- Atomic rollback, immutable-source, request-key replay/conflict, and concurrent same-key tests.
- Direct table write denial and preservation of existing manual and approved records.

The existing pending client-intake/reviewer material in `supabase/pending/20261005_client_requirement_intake.sql` does **not** provide this Master Specification version binding and must not be treated as satisfying it.