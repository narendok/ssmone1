# BACKEND GAPS

This checkpoint records evidence gaps only. No remediation was executed.

| Domain | Expected feature | Missing or unverified contract | Web phase | Mobile stage | Severity | Security / transaction impact | Additive remediation |
|---|---|---|---|---|---|---|---|
| Stores | Material issue posting | No dedicated atomic server transaction evidenced. | 6 | 5 | HIGH | Client-composed writes could corrupt stock/audit state. | Add a permission-checked database RPC with stock validation, ledger update, server numbering, request key, and audit. |
| Stores | Return / transfer / adjustment | No dedicated atomic server transaction evidenced. | 6 | 5 | HIGH | Balance, reservation, and ledger integrity unverified. | Add separate atomic server contracts with idempotency keys and audit. |
| GRN | Safe retry | Idempotency contract not evidenced for `create_grn`. | 6 | 5 | HIGH | Retry after a network timeout could duplicate receipt effects. | Add server-enforced idempotency key and unique request record. |
| Commercial isolation | Field-safe mobile contract | Existing RLS/permissions exist, but a purpose-built mobile projection for commercial fields was not evidenced. | 6 | 5 | MEDIUM | Mobile queries could over-request commercial data if policies permit. | Add secure views/RPC projections for non-finance operational roles after an access review. |
| Environments | DEV/UAT/PROD separation | Separate environment strategy not evidenced. | Cross-phase | All | MEDIUM | Test usage could affect the shared backend. | Provision and document an additive environment strategy before broad mobile rollout. |
| Webhooks | Outbound delivery/retry | Registry and signed inbound endpoint exist; outbound dispatch/retry worker not evidenced. | 10 | 10 | MEDIUM | No reliable partner event delivery contract. | Add a server-side dispatcher with signed payloads, retries, health, and idempotency. |
| Tests | Cross-domain mobile authorization | A mobile-specific RLS/isolation acceptance suite is not evidenced. | Cross-phase | All | MEDIUM | Role/data isolation regressions may go undetected. | Add automated session-based contract tests before each mobile-stage release. |
