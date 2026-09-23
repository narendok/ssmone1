# Phase 10 — External Collaboration Extensions

## What will be delivered
- Add a unified external-party and external-contact layer that reuses existing customers and vendors instead of duplicating them.
- Add role- and scope-based external access, invitations, deactivation, and least-privilege policies for authenticated portal users.
- Extend controlled sharing with immutable snapshots, expiry/revocation, recipient restrictions, permissions, and access-event audit trails.
- Add internal workspaces for transmittals, external review requests, actions, upload requests, data rooms, and collaboration monitoring.
- Add a lightweight external portal shell for Customer/OEM, Supplier, EMS, Lab, Consultant, Contractor, and Auditor views; only explicitly published records will be available.
- Connect portal actions to existing requirements, NDA, project, Drive, PPAP, RFQ/quotation, PO, shipment, quality, calibration, complaint, warranty, and customer-satisfaction records without copying their source-of-truth data.
- Add controlled staged uploads, internal accept/reject/replacement decisions, provenance/checksum fields, and segregated external comments.
- Add API client, webhook endpoint, idempotency, integration-health, and human-reviewed automation foundations.
- Validate customer/supplier isolation, revocation, expiry, frozen revision sharing, upload staging, transmittal revision freezing, RFQ/ASN routing, EMS and lab controls, complaint safety, NDA gating, external-user deactivation, webhook rejection, AI review gating, and storage/RLS constraints.

## Technical details
- Use additive Lovable Cloud migrations with explicit grants, RLS, security-definer permission helpers, audit timestamps, and no public confidential storage.
- Reuse existing Drive shares, customer portal access, Shared BOMs, requirements, PPAP, RFQ, purchase order, shipment, DVP&R, calibration, and Phase 9 customer-quality data.
- Keep secure links distinctly scoped from recurring authenticated access. New portal routes remain separate from internal navigation.
- Never grant external access based only on membership, a copied URL, or UI filtering. Enforce every record/file read and write in database policies and server functions.
- AI assistance produces evidence-bound drafts or extraction candidates marked for human review; it never independently sends, approves, closes, or publishes external content.

## Deferred
- Certified electronic-signature compliance and live third-party ERP/logistics/e-sign integrations remain integration-ready only unless credentials and connector setup are separately requested.
- Phase 11 will not be started automatically.
