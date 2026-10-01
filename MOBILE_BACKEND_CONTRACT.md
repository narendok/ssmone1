# MOBILE BACKEND CONTRACT

**Generated:** 2026-10-01 UTC; refreshed for controlled-document, company-process, and BOM source-traceability handoff.  
**Authority:** live managed backend inventory, current migration history, and `src/integrations/supabase/types.ts`. This contract does not create a mobile backend or mobile UI. Object classifications below describe handoff suitability, not a blanket confirmation that every mobile user can read every object; RLS and purpose-specific permissions remain authoritative.

## Environment strategy

- Android may receive only `SUPABASE_URL` and `SUPABASE_ANON_OR_PUBLISHABLE_KEY` through its secure build configuration.
- Never ship a service-role key, database password, JWT signing key, OAuth secret, or any server-only vendor key.
- One managed backend is currently evidenced for preview and production. Separate DEV/UAT/PROD environments are **not evidenced** and must not be assumed.

## Authentication, identity, and authorization

- Reuse the same managed authentication account/session as the web application.
- Identity contract: `profiles` → `employees` (when staff-linked), `user_roles`, `employee_access_roles`, `employee_departments`.
- Authorization is enforced by RLS plus `has_role`, `has_permission`, `has_any_permission`, and domain helpers. Android must not store or decide a role locally.

## Authoritative domain object map

`MOBILE_READ_SAFE` means an object may be evaluated for a mobile read surface only through a current-user session and its existing RLS policies. It does not imply unrestricted access, offline write support, or financial-data suitability.

| Platform support | `access_role_permissions` | role_id + permission_id | — | — | MOBILE_READ_SAFE |
| Identity & access | `access_roles` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `activity_log` | id | — | — | MOBILE_READ_SAFE |
| Identity & access | `application_modules` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `asset_assignments` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `asset_categories` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `assets` | id | asset_code | status | MOBILE_READ_SAFE |
| Common work & documents | `assignment_batches` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `assignments` | id | — | — | MOBILE_READ_SAFE |
| Automation & provenance | `automation_job_leases` | id | — | — | MOBILE_READ_SAFE |
| Automation & provenance | `automation_rules` | id | — | — | MOBILE_READ_SAFE |
| Automation & provenance | `automation_runs` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `calibration_records` | id | record_code | — | MOBILE_READ_SAFE |
| Platform support | `categories` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `component_projects` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `component_substitutes` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `components` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `customer_complaints` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `customer_contacts` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `customer_field_failures` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `customer_portal_access` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `customer_portal_shares` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `customer_requirement_revisions` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `customer_requirements` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `customer_returns` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `customer_satisfaction_surveys` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `customer_warranty_claims` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `customers` | id | customer_code | — | MOBILE_READ_SAFE |
| Automation & provenance | `data_provenance` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `datasheet_cache` | id | — | — | MOBILE_READ_SAFE |
| Identity & access | `departments` | id | — | — | MOBILE_READ_SAFE |
| Platform support | `document_numbering_config` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `document_control_registers` | id | document_number + drive_node_id | document_status | MOBILE_READ_SAFE |
| Common work & documents | `document_control_events` | id | register_id + created_at | event_type | MOBILE_READ_SAFE |
| Common work & documents | `controlled_document_audit_gaps` | register_id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `controlled_document_audit_timeline` | id | register_id + created_at | event_type | MOBILE_READ_SAFE |
| Common work & documents | `drive_node_revisions` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `drive_nodes` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `drive_share_links` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `drive_user_favorites` | id | — | — | MOBILE_READ_SAFE |
| Identity & access | `employee_access_roles` | employee_id + role_id | — | — | MOBILE_READ_SAFE |
| Identity & access | `employee_departments` | employee_id + department_id | — | — | MOBILE_READ_SAFE |
| Identity & access | `employees` | id | employee_code | — | MOBILE_READ_SAFE |
| Common work & documents | `entity_registry` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_access_events` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_actions` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_api_clients` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_contacts` | id | — | — | MOBILE_READ_SAFE |
| Automation & provenance | `external_data_cache` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_data_room_items` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_data_rooms` | id | — | — | MOBILE_READ_SAFE |
| Automation & provenance | `external_integrations` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_parties` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_portal_access` | id | — | is_active / expires_at | MOBILE_READ_SAFE |
| External collaboration | `external_review_requests` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_share_snapshots` | id | snapshot_code | revoked_at / expires_at | MOBILE_READ_SAFE |
| External collaboration | `external_transmittals` | id | transmittal_number | — | MOBILE_READ_SAFE |
| External collaboration | `external_upload_requests` | id | request_code | — | MOBILE_READ_SAFE |
| External collaboration | `external_uploads` | id | — | — | MOBILE_READ_SAFE |
| External collaboration | `external_webhook_deliveries` | id | — | — | ONLINE_REQUIRED |
| External collaboration | `external_webhook_subscriptions` | id | — | active / disabled_at | MOBILE_READ_SAFE |
| Facility, assets & security | `facility_location_responsibilities` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `facility_locations` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `goods_receipt_items` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `goods_receipt_notes` | id | grn_number | status | ONLINE_REQUIRED |
| HR, QMS & management | `hr_applications` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_assessments` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_candidates` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_employee_onboarding_items` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_employee_onboardings` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_interview_feedback` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_interview_rounds` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_job_postings` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_job_profiles` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_job_requisitions` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_leave_balances` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_leave_requests` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_leave_types` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_offers` | id | — | — | MOBILE_READ_SAFE |
| Platform support | `hr_onboarding_items` | id | — | — | MOBILE_READ_SAFE |
| Platform support | `hr_onboarding_plans` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_policies` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_policy_acknowledgements` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_training_enrollments` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `hr_training_programs` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `imte_instruments` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `incoming_inspections` | id | — | status | MOBILE_READ_SAFE |
| Procurement, stores & quality | `inventory_lots` | id | — | status | ONLINE_REQUIRED |
| Procurement, stores & quality | `inventory_reservations` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `locations` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `maintenance_plans` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `maintenance_work_orders` | id | work_order_code | status | MOBILE_READ_SAFE |
| Facility, assets & security | `material_gate_passes` | id | pass_code | — | MOBILE_READ_SAFE |
| Common work & documents | `notifications` | id | — | — | MOBILE_READ_SAFE |
| Platform support | `organizations` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `payment_milestones` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `pcb_task_history` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `pcb_task_notes` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `pcb_task_photos` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `pcb_tasks` | id | — | — | MOBILE_READ_SAFE |
| Identity & access | `permissions` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `po_delivery_revisions` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `po_shipments` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_dispatch_units` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_dispatches` | id | — | — | ONLINE_REQUIRED |
| Production | `production_finished_goods_releases` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_in_process_inspections` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_kit_lines` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_kits` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_ncrs` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_ppap_packages` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_route_steps` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_routes` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_step_executions` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_unit_tests` | id | — | — | MOBILE_READ_SAFE |
| Production | `production_units` | id | — | status | ONLINE_REQUIRED |
| Identity & access | `profiles` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_bom_items` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_boms` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_change_requests` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_design_inputs` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_engineering_registers` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_issues` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_research_records` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `project_stage_gates` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `company_process_stages` | id | stage_code | is_active | MOBILE_READ_SAFE |
| Engineering & R&D | `project_process_stage_records` | id | project_id + company_process_stage_id | status | MOBILE_READ_SAFE |
| Common work & documents | `project_task_activity` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `project_task_checklists` | id | — | — | MOBILE_READ_SAFE |
| Common work & documents | `project_tasks` | id | — | status | MOBILE_READ_SAFE |
| Engineering & R&D | `project_team_members` | project_id + employee_id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `projects` | id | project_code | status | MOBILE_READ_SAFE |
| Procurement, stores & quality | `purchase_order_items` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `purchase_orders` | id | po_number | status | ONLINE_REQUIRED |
| Procurement, stores & quality | `purchase_request_items` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `purchase_requests` | id | request_number | status | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_audit_findings` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_audits` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_capas` | id | capa_number | status | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_contingency_plans` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_contingency_tests` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_improvements` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_kpi_formula_versions` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_kpi_snapshots` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_kpis` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_lessons_learned` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_management_reviews` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_objective_kpis` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_quality_objectives` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_retention_policies` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `qms_risks` | id | — | — | MOBILE_READ_SAFE |
| HR, QMS & management | `quick_expenses` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `quotation_items` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `quotations` | id | quotation_number | status | MOBILE_READ_SAFE |
| Platform support | `rd_members` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `requirement_baselines` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `requirement_change_requests` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `requirement_feasibility_reviews` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `rfq_vendors` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `rfqs` | id | rfq_number | status | MOBILE_READ_SAFE |
| Procurement, stores & quality | `rtv_records` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `sales_commercial_records` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `sales_enquiries` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `sales_nda_records` | id | — | — | MOBILE_READ_SAFE |
| Platform support | `sales_nda_templates` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `sales_opportunities` | id | — | — | MOBILE_READ_SAFE |
| Sales & customer | `sales_project_handovers` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `security_incidents` | id | — | — | MOBILE_READ_SAFE |
| Engineering & R&D | `shared_boms` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `stock_history` | id | — | — | ONLINE_REQUIRED |
| Procurement, stores & quality | `supplier_ncrs` | id | — | — | MOBILE_READ_SAFE |
| Identity & access | `user_roles` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `vehicle_entries` | id | — | — | MOBILE_READ_SAFE |
| Procurement, stores & quality | `vendors` | id | vendor_code | — | MOBILE_READ_SAFE |
| Facility, assets & security | `visitor_visits` | id | visit_code | — | MOBILE_READ_SAFE |
| Production | `work_order_materials` | id | — | — | MOBILE_READ_SAFE |
| Production | `work_orders` | id | work_order_number | status | ONLINE_REQUIRED |
| Facility, assets & security | `workstation_allocations` | id | — | — | MOBILE_READ_SAFE |
| Facility, assets & security | `workstations` | id | — | — | MOBILE_READ_SAFE |

## Domain inventory

### Identity & access

- `profiles`
- `employees`
- `departments`
- `access_roles`
- `permissions`
- `user_roles`
- `employee_access_roles`
- `employee_departments`
- `application_modules`

### Common work & documents

- `project_tasks`
- `project_task_checklists`
- `project_task_activity`
- `assignments`
- `assignment_batches`
- `notifications`
- `activity_log`
- `entity_registry`
- `drive_nodes`
- `drive_node_revisions`
- `drive_share_links`
- `drive_user_favorites`

### Engineering & R&D

- `projects`
- `project_team_members`
- `project_design_inputs`
- `project_research_records`
- `project_engineering_registers`
- `project_stage_gates`
- `project_issues`
- `project_change_requests`
- `components`
- `component_projects`
- `component_substitutes`
- `datasheet_cache`
- `project_boms`
- `project_bom_items`
- `shared_boms`
- `pcb_tasks`
- `pcb_task_history`
- `pcb_task_notes`
- `pcb_task_photos`

### Sales & customer

- `customers`
- `customer_contacts`
- `sales_enquiries`
- `sales_opportunities`
- `sales_nda_records`
- `sales_commercial_records`
- `sales_project_handovers`
- `customer_requirements`
- `customer_requirement_revisions`
- `requirement_baselines`
- `requirement_change_requests`
- `requirement_feasibility_reviews`
- `customer_portal_access`
- `customer_portal_shares`

### Procurement, stores & quality

- `vendors`
- `purchase_requests`
- `purchase_request_items`
- `rfqs`
- `rfq_vendors`
- `quotations`
- `quotation_items`
- `purchase_orders`
- `purchase_order_items`
- `po_delivery_revisions`
- `po_shipments`
- `goods_receipt_notes`
- `goods_receipt_items`
- `inventory_lots`
- `inventory_reservations`
- `stock_history`
- `locations`
- `incoming_inspections`
- `rtv_records`
- `supplier_ncrs`
- `payment_milestones`

### Production

- `production_routes`
- `production_route_steps`
- `work_orders`
- `work_order_materials`
- `production_kits`
- `production_kit_lines`
- `production_units`
- `production_step_executions`
- `production_in_process_inspections`
- `production_unit_tests`
- `production_ncrs`
- `production_finished_goods_releases`
- `production_ppap_packages`
- `production_dispatches`
- `production_dispatch_units`

### Facility, assets & security

- `facility_locations`
- `facility_location_responsibilities`
- `asset_categories`
- `assets`
- `asset_assignments`
- `maintenance_plans`
- `maintenance_work_orders`
- `imte_instruments`
- `calibration_records`
- `workstations`
- `workstation_allocations`
- `visitor_visits`
- `vehicle_entries`
- `material_gate_passes`
- `security_incidents`

### HR, QMS & management

- `hr_job_postings`
- `hr_job_profiles`
- `hr_job_requisitions`
- `hr_candidates`
- `hr_applications`
- `hr_assessments`
- `hr_interview_rounds`
- `hr_interview_feedback`
- `hr_offers`
- `hr_employee_onboardings`
- `hr_employee_onboarding_items`
- `hr_leave_types`
- `hr_leave_balances`
- `hr_leave_requests`
- `hr_policies`
- `hr_policy_acknowledgements`
- `hr_training_programs`
- `hr_training_enrollments`
- `quick_expenses`
- `qms_quality_objectives`
- `qms_kpis`
- `qms_kpi_formula_versions`
- `qms_kpi_snapshots`
- `qms_objective_kpis`
- `qms_risks`
- `qms_contingency_plans`
- `qms_contingency_tests`
- `qms_audits`
- `qms_audit_findings`
- `qms_capas`
- `qms_improvements`
- `qms_lessons_learned`
- `qms_management_reviews`
- `qms_retention_policies`
- `customer_complaints`
- `customer_field_failures`
- `customer_warranty_claims`
- `customer_returns`
- `customer_satisfaction_surveys`

### Automation & provenance

- `automation_rules`
- `automation_runs`
- `automation_job_leases`
- `data_provenance`
- `external_data_cache`
- `external_integrations`

### External collaboration

- `external_parties`
- `external_contacts`
- `external_portal_access`
- `external_share_snapshots`
- `external_access_events`
- `external_transmittals`
- `external_review_requests`
- `external_actions`
- `external_upload_requests`
- `external_uploads`
- `external_data_rooms`
- `external_data_room_items`
- `external_api_clients`
- `external_webhook_subscriptions`
- `external_webhook_deliveries`

## Database function / RPC inventory

| Function | Contract |
|---|---|
| `can_inward` | See generated type signature; server/database function. |
| `can_manage_leave` | See generated type signature; server/database function. |
| `can_manage_onboarding` | See generated type signature; server/database function. |
| `can_manage_recruitment` | See generated type signature; server/database function. |
| `can_manage_training` | See generated type signature; server/database function. |
| `can_purchase` | See generated type signature; server/database function. |
| `complete_automation_lease` | See generated type signature; server/database function. |
| `create_grn` | Atomic GRN posting via a security-definer RPC; service-side only. |
| `create_phase6_quotation` | Controlled supplier quotation creation; server-side only. |
| `create_phase6_rfq` | Controlled RFQ creation; server-side only. |
| `create_phase7_dispatch` | See generated type signature; server/database function. |
| `create_phase7_ppap_package` | See generated type signature; server/database function. |
| `create_phase7_work_order` | Controlled work-order creation; server-side only. |
| `create_purchase_order` | Atomic PO header and line creation via a security-definer RPC; service-side only. |
| `create_purchase_request_from_bom_shortage` | See generated type signature; server/database function. |
| `decide_incoming_inspection` | Incoming inspection decision; server-side only. |
| `decide_phase7_finished_goods_release` | See generated type signature; server/database function. |
| `decide_phase7_ppap_package` | See generated type signature; server/database function. |
| `disposition_phase7_ncr` | See generated type signature; server/database function. |
| `ensure_phase5_project_access_catalog` | See generated type signature; server/database function. |
| `external_contact_has_access` | See generated type signature; server/database function. |
| `external_current_contact_id` | See generated type signature; server/database function. |
| `external_current_party_id` | See generated type signature; server/database function. |
| `external_is_current_contact` | See generated type signature; server/database function. |
| `external_is_staff_manager` | See generated type signature; server/database function. |
| `external_log_access` | Server-side external access audit writer. |
| `get_drive_breadcrumbs` | See generated type signature; server/database function. |
| `get_public_application_status` | See generated type signature; server/database function. |
| `has_any_permission` | See generated type signature; server/database function. |
| `has_permission` | See generated type signature; server/database function. |
| `has_role` | See generated type signature; server/database function. |
| `is_employee_manager` | See generated type signature; server/database function. |
| `mark_po_sent` | See generated type signature; server/database function. |
| `next_business_number` | Central business-identifier allocator; do not call from mobile. |
| `next_document_number` | Central document-number allocator; do not call from mobile. |
| `phase6_can_finance` | See generated type signature; server/database function. |
| `phase6_can_quality` | See generated type signature; server/database function. |
| `phase6_shortage_snapshot` | See generated type signature; server/database function. |
| `phase7_can_production` | See generated type signature; server/database function. |
| `phase8_can` | See generated type signature; server/database function. |
| `provision_drive_for_project` | See generated type signature; server/database function. |
| `record_phase7_unit_execution` | Controlled unit execution event; server-side only. |
| `record_phase7_unit_inspection` | Controlled in-process inspection; server-side only. |
| `record_phase7_unit_test` | Controlled unit test; server-side only. |
| `review_phase6_record` | Controlled Phase 6 decision; server-side only. |
| `short_close_po_item` | See generated type signature; server/database function. |
| `submit_public_job_application` | See generated type signature; server/database function. |
| `toggle_node_star` | See generated type signature; server/database function. |
| `transition_document_control` | Protected controlled-document action. Web-only server action currently wraps this RPC; Android must not call it until a dedicated mobile contract is approved. |
| `transition_phase7_work_order` | Controlled work-order lifecycle transition; server-side only. |
| `try_acquire_automation_lease` | See generated type signature; server/database function. |

## Server transaction contracts

### Final GRN

- **Authority:** `create_grn(_po_id, _vendor_invoice_number, _vendor_invoice_date, _storage_notes, _items, _idempotency_key)`
- **Caller:** authenticated approved operational client/session; Android sends the protected RPC only with its current session and never with privileged credentials.
- **Inputs/outputs:** authoritative generated signature is in `src/integrations/supabase/types.ts`; returns JSON.
- **Atomicity:** **VERIFIED** as one database RPC.
- **Idempotency:** **VERIFIED** — request UUID plus canonical payload fingerprint returns the original result on identical retry and rejects conflicting reuse.
- **Concurrency:** **VERIFIED** — PO and affected PO item rows are locked before balance validation/mutation in the same posting transaction.
- **Authorization:** `can_inward` is checked inside the protected contract.
- **Numbering:** server-controlled; **VERIFIED**.

### Material issue / return / transfer / adjustment / RTV

- **Material issue:** `post_material_issue` — online-only, numbered, permission-checked, idempotent atomic posting.
- **Return:** `post_material_return` — online-only, numbered, partial-return-aware, idempotent atomic posting.
- **Transfer:** `post_stock_transfer` — online-only, balance-neutral, numbered, idempotent atomic posting.
- **Adjustment:** `post_stock_adjustment` — online-only, reason-required, numbered, idempotent atomic posting.
- **RTV:** `rtv_records` exists with a controlled review contract, but stock posting atomicity/idempotency/concurrency are **NOT VERIFIED**.

## Storage inventory

| Bucket | Public | Path / use | Mobile rule |
|---|---|---|---|
| `project-drive` | No | Project-scoped drive objects | Read only through authorized RLS/signed delivery flows. |
| `pcb-photos` | No | PCB task evidence | Authorized engineering/project use only. |
| `datasheet-cache` | No | Datasheet cache | Treat as private cached reference data. |
| `external-staging` | No | `{party_id}/{contact_id}/{uuid}-{filename}` | Server-issued upload token; review required before internal use. |

## Mobile action classification

| Action | Classification | Rule |
|---|---|---|
| Lists and detail reads allowed by RLS | MOBILE_READ_SAFE | Cache only data authorized for the active session. |
| Task/activity/checklist drafts | OFFLINE_DRAFT_ONLY | Revalidate authorization and current record state when submitting. |
| Final GRN, stock posting, material issue/return/transfer/adjustment | ONLINE_REQUIRED | Invoke an approved server contract only; do not compose client-side writes. |
| Releases, approvals, PPAP, dispatch | ONLINE_REQUIRED | Server function/RPC plus permissions. |
| External webhook deliveries / integration secrets | NOT_FOR_MOBILE | Server-only. |

## Offline policy

- Use one Android sync coordinator.
- **Cache read-only:** authorized reference data, assigned tasks, permitted documents metadata.
- **Offline draft only:** task notes/checklists and user-entered form drafts without official identifiers.
- **Online only:** all approvals, releases, inventory effects, GRN, production execution decisions, external access changes, and any controlled business identifier.
- Do not generate official numbers on-device; server numbering functions and triggers are the authority.

## Controlled Stage 5 test seed and extended safe projections

- `seed_mobile_stage5_test_data()` is an idempotent, Administrator-only, security-invoker helper for approved shared-environment acceptance preparation. It creates only clearly labelled `TEST-MOB-*` vendor, purchase-request, RFQ and, when the matching existing test PO is available, shipment data. It preserves all existing records and audit trails.
- Safe signed-in operational projections are available for PR/RFQ/shipment/vendor reads: `operational_purchase_requests`, `operational_purchase_request_items`, `operational_rfqs`, `operational_rfq_vendors`, `operational_po_shipments`, and `operational_vendors`.
- These views apply the caller’s existing RLS and deliberately exclude commercial or sensitive vendor data: unit price, totals, tax, payment terms, bank details, contact details, tracking payloads, and invoice paths.

## Known backend gaps for mobile

See `BACKEND_GAPS.md`. Stage 5 stock posting and procurement/stores safe-read gaps are remediated; legacy migration reconciliation, environment separation, outbound webhook delivery, and full live-session acceptance evidence remain documented gaps.

## OEM audit traceability handoff — 2026-10-01

### Controlled-document read model

- `document_control_registers` remains the single controlled-document register. Every row is anchored to `drive_node_id`; `source_revision_id` and `source_revision_number` identify the recorded Drive revision when available.
- Revision context is stored in `drive_node_revisions`: `node_id`, `version`, `storage_path`, checksum, file size, change summary, uploader, and timestamp. A controlled source revision must belong to the registered Drive file.
- The register now includes `project_id`, owner/reviewer/approver employee links, reviewer decision/timestamp, release timestamp, change reason, linked task, evidence Drive file, and a self-reference for supersession. Existing records may legitimately have these fields unset; this is reported as a gap rather than treated as approval evidence.
- Read `controlled_document_audit_timeline` for chronological decisions and `controlled_document_audit_gaps` for honest missing-source, owner, reviewer, approver, reason, task, or evidence flags. Both run with caller RLS and do not widen departmental or project access.

### Company process taxonomy and lifecycle links

- `company_process_stages` contains the internal HW_01–HW_37 taxonomy only. It is not evidence of APQP compliance, certification, customer applicability, or audit completion.
- `project_process_stage_records` maps a project to the taxonomy with `NOT_STARTED`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `HANDED_OVER`, `COMPLETE`, or `REDESIGN_REQUIRED`; it may link an owner/reviewer, predecessor, task, Drive evidence, and engineering change request.
- Existing `project_stage_gates`, `project_change_requests`, `project_engineering_registers`, and `project_tasks` remain authoritative for their own domains. The new record links rather than duplicates them.

### BOM source traceability

- `project_boms` now optionally holds `source_drive_node_id` and `source_drive_revision_id`. The source file must belong to the BOM project and the revision must belong to that file.
- `source_filename` and free-text `revision` remain legacy display fields. They are not proof of a source file or released revision without the Drive links.

### Controlled actions and mobile boundary

- The protected `transition_document_control(p_register_id uuid, p_action text, p_expected_status text, p_note text, p_change_reason text, p_request_key uuid)` action supports `SUBMIT_REVIEW`, `REVIEW_APPROVE`, `REVIEW_REJECT`, `APPROVE`, `RELEASE`, and `SUPERSEDE`.
- It requires an authenticated, permitted caller in the document's department/project scope; assigned reviewer/approver checks apply when assignments exist. It locks the register row, enforces expected-status concurrency, records an action receipt by UUID request key, writes the existing event history, and writes `activity_log`.
- Android has no dedicated mobile mutation wrapper for this action yet. Treat document decisions, release, and supersession as **ONLINE_REQUIRED / WEB_ONLY** until an Android-specific authenticated server action and session-scoped acceptance test are approved.
- Private Drive files remain private. Current mobile consumers must use a separately authorized signed-delivery flow; no general mobile signed-file endpoint for controlled records is documented by this handoff.

### Verified gaps and acceptance limits

- No real reviewer/approver assignments, controlled-document records, customer applicability matrix, certificates, KPI targets, or OEM audit results were invented or seeded.
- Signed-in session/RLS acceptance for this new workflow and Android delivery has not been executed because dedicated test identities/environment support is unavailable.
- Legacy register rows can be read but need source-revision, owner/reviewer/approver, change-reason, task, and evidence completion before they form a complete audit trail.
