export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          module_key: string
          reason: string | null
          summary: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          module_key: string
          reason?: string | null
          summary: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          module_key?: string
          reason?: string | null
          summary?: string
        }
        Relationships: []
      }
      application_modules: {
        Row: {
          created_at: string
          group_key: string
          icon_key: string | null
          id: string
          key: string
          name: string
          route_path: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_key: string
          icon_key?: string | null
          id?: string
          key: string
          name: string
          route_path?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_key?: string
          icon_key?: string | null
          id?: string
          key?: string
          name?: string
          route_path?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_assignments: {
        Row: {
          accepted_at: string | null
          asset_id: string
          assigned_at: string
          assigned_by: string | null
          assigned_location_id: string | null
          assigned_to_user_id: string | null
          created_at: string
          handover_notes: string | null
          id: string
          returned_at: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          asset_id: string
          assigned_at?: string
          assigned_by?: string | null
          assigned_location_id?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          handover_notes?: string | null
          id?: string
          returned_at?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          asset_id?: string
          assigned_at?: string
          assigned_by?: string | null
          assigned_location_id?: string | null
          assigned_to_user_id?: string | null
          created_at?: string
          handover_notes?: string | null
          id?: string
          returned_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_location_id_fkey"
            columns: ["assigned_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_calibration: boolean
          requires_maintenance: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_calibration?: boolean
          requires_maintenance?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_calibration?: boolean
          requires_maintenance?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          acquisition_cost: number | null
          acquisition_date: string | null
          amc_expiry: string | null
          approved_at: string | null
          approved_by: string | null
          asset_code: string
          category_id: string | null
          created_at: string
          created_by: string | null
          custodian_user_id: string | null
          facility_location_id: string | null
          grn_id: string | null
          id: string
          manufacturer: string | null
          model_number: string | null
          name: string
          purchase_order_id: string | null
          qr_payload: string
          serial_number: string | null
          specifications: Json
          status: string
          updated_at: string
          vendor_id: string | null
          warranty_expiry: string | null
        }
        Insert: {
          acquisition_cost?: number | null
          acquisition_date?: string | null
          amc_expiry?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_code: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          custodian_user_id?: string | null
          facility_location_id?: string | null
          grn_id?: string | null
          id?: string
          manufacturer?: string | null
          model_number?: string | null
          name: string
          purchase_order_id?: string | null
          qr_payload: string
          serial_number?: string | null
          specifications?: Json
          status?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          acquisition_cost?: number | null
          acquisition_date?: string | null
          amc_expiry?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_code?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          custodian_user_id?: string | null
          facility_location_id?: string | null
          grn_id?: string | null
          id?: string
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          purchase_order_id?: string | null
          qr_payload?: string
          serial_number?: string | null
          specifications?: Json
          status?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_facility_location_id_fkey"
            columns: ["facility_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_batches: {
        Row: {
          assignee_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          project_id: string | null
        }
        Insert: {
          assignee_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
        }
        Update: {
          assignee_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_batches_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "rd_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_batches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignee_id: string
          batch_id: string | null
          component_id: string
          id: string
          location_id: string | null
          notes: string | null
          project_id: string | null
          project_name: string | null
          quantity: number
          quantity_returned: number
          returned_at: string | null
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id: string
          batch_id?: string | null
          component_id: string
          id?: string
          location_id?: string | null
          notes?: string | null
          project_id?: string | null
          project_name?: string | null
          quantity: number
          quantity_returned?: number
          returned_at?: string | null
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id?: string
          batch_id?: string | null
          component_id?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          project_id?: string | null
          project_name?: string | null
          quantity?: number
          quantity_returned?: number
          returned_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "rd_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "assignment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_job_leases: {
        Row: {
          job_key: string
          last_completed_at: string | null
          last_error: string | null
          last_started_at: string | null
          lease_expires_at: string | null
          pause_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          job_key: string
          last_completed_at?: string | null
          last_error?: string | null
          last_started_at?: string | null
          lease_expires_at?: string | null
          pause_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          job_key?: string
          last_completed_at?: string | null
          last_error?: string | null
          last_started_at?: string | null
          lease_expires_at?: string | null
          pause_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          effective_from: string | null
          effective_until: string | null
          execution_mode: string
          id: string
          is_enabled: boolean
          name: string
          owner_user_id: string | null
          priority: number
          rule_key: string
          trigger_key: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          execution_mode?: string
          id?: string
          is_enabled?: boolean
          name: string
          owner_user_id?: string | null
          priority?: number
          rule_key: string
          trigger_key: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          execution_mode?: string
          id?: string
          is_enabled?: boolean
          name?: string
          owner_user_id?: string | null
          priority?: number
          rule_key?: string
          trigger_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          affected_entity_id: string | null
          affected_entity_type: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          initiated_by: string | null
          input_data: Json
          result_data: Json
          rule_id: string | null
          started_at: string | null
          status: string
          trigger_key: string
        }
        Insert: {
          affected_entity_id?: string | null
          affected_entity_type?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          initiated_by?: string | null
          input_data?: Json
          result_data?: Json
          rule_id?: string | null
          started_at?: string | null
          status?: string
          trigger_key: string
        }
        Update: {
          affected_entity_id?: string | null
          affected_entity_type?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          initiated_by?: string | null
          input_data?: Json
          result_data?: Json
          rule_id?: string | null
          started_at?: string | null
          status?: string
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_records: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          calibrated_on: string
          certificate_drive_node_id: string | null
          certificate_reference: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          instrument_id: string
          notes: string | null
          provider_name: string | null
          record_code: string
          result: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          calibrated_on: string
          certificate_drive_node_id?: string | null
          certificate_reference?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          instrument_id: string
          notes?: string | null
          provider_name?: string | null
          record_code: string
          result: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          calibrated_on?: string
          certificate_drive_node_id?: string | null
          certificate_reference?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          instrument_id?: string
          notes?: string | null
          provider_name?: string | null
          record_code?: string
          result?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_records_certificate_drive_node_id_fkey"
            columns: ["certificate_drive_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_records_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "imte_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      component_projects: {
        Row: {
          component_id: string
          created_at: string
          project_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          project_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_projects_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      component_substitutes: {
        Row: {
          component_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          substitute_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          substitute_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          substitute_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_substitutes_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_substitutes_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      components: {
        Row: {
          alternates: Json | null
          bom_compatibility: string | null
          category_id: string
          cost: number | null
          created_at: string
          current_rating: string | null
          datasheet_url: string | null
          footprint: string | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          manufacturer: string | null
          name: string
          needs_review: boolean
          nexar_part_id: string | null
          notes: string | null
          package_case: string | null
          part_number: string
          short_description: string | null
          specs: Json | null
          supplier: string | null
          supplier_synced_at: string | null
          supplier_url: string | null
          temperature_rating: string | null
          updated_at: string
          value: string | null
          voltage_rating: string | null
        }
        Insert: {
          alternates?: Json | null
          bom_compatibility?: string | null
          category_id?: string
          cost?: number | null
          created_at?: string
          current_rating?: string | null
          datasheet_url?: string | null
          footprint?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          manufacturer?: string | null
          name: string
          needs_review?: boolean
          nexar_part_id?: string | null
          notes?: string | null
          package_case?: string | null
          part_number: string
          short_description?: string | null
          specs?: Json | null
          supplier?: string | null
          supplier_synced_at?: string | null
          supplier_url?: string | null
          temperature_rating?: string | null
          updated_at?: string
          value?: string | null
          voltage_rating?: string | null
        }
        Update: {
          alternates?: Json | null
          bom_compatibility?: string | null
          category_id?: string
          cost?: number | null
          created_at?: string
          current_rating?: string | null
          datasheet_url?: string | null
          footprint?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          manufacturer?: string | null
          name?: string
          needs_review?: boolean
          nexar_part_id?: string | null
          notes?: string | null
          package_case?: string | null
          part_number?: string
          short_description?: string | null
          specs?: Json | null
          supplier?: string | null
          supplier_synced_at?: string | null
          supplier_url?: string | null
          temperature_rating?: string | null
          updated_at?: string
          value?: string | null
          voltage_rating?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "components_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_complaints: {
        Row: {
          closure_due_date: string | null
          complaint_code: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_visible_update: string | null
          description: string
          dispatch_id: string | null
          id: string
          internal_analysis: string | null
          owner_user_id: string | null
          production_unit_id: string | null
          project_id: string | null
          received_at: string
          response_due_date: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closure_due_date?: string | null
          complaint_code: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_visible_update?: string | null
          description: string
          dispatch_id?: string | null
          id?: string
          internal_analysis?: string | null
          owner_user_id?: string | null
          production_unit_id?: string | null
          project_id?: string | null
          received_at?: string
          response_due_date?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closure_due_date?: string | null
          complaint_code?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_visible_update?: string | null
          description?: string
          dispatch_id?: string | null
          id?: string
          internal_analysis?: string | null
          owner_user_id?: string | null
          production_unit_id?: string | null
          project_id?: string | null
          received_at?: string
          response_due_date?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_complaints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "production_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_primary: boolean
          job_title: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          job_title?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          job_title?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_field_failures: {
        Row: {
          analysis_status: string
          analysis_summary: string | null
          complaint_id: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string
          failure_code: string
          failure_mode: string | null
          failure_summary: string
          id: string
          production_unit_id: string | null
          return_id: string | null
          updated_at: string
        }
        Insert: {
          analysis_status?: string
          analysis_summary?: string | null
          complaint_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          failure_code: string
          failure_mode?: string | null
          failure_summary: string
          id?: string
          production_unit_id?: string | null
          return_id?: string | null
          updated_at?: string
        }
        Update: {
          analysis_status?: string
          analysis_summary?: string | null
          complaint_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          failure_code?: string
          failure_mode?: string | null
          failure_summary?: string
          id?: string
          production_unit_id?: string | null
          return_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_field_failures_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_field_failures_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_field_failures_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "customer_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_access: {
        Row: {
          access_token: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          access_token?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          access_token?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_access_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_access_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_shares: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          permission: string
          portal_access_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          permission?: string
          portal_access_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          permission?: string
          portal_access_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_shares_portal_access_id_fkey"
            columns: ["portal_access_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_access"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requirement_revisions: {
        Row: {
          change_summary: string
          created_at: string
          created_by: string | null
          id: string
          requirement_data: Json
          requirement_id: string
          revision_number: number
          status: string
        }
        Insert: {
          change_summary: string
          created_at?: string
          created_by?: string | null
          id?: string
          requirement_data?: Json
          requirement_id: string
          revision_number: number
          status?: string
        }
        Update: {
          change_summary?: string
          created_at?: string
          created_by?: string | null
          id?: string
          requirement_data?: Json
          requirement_id?: string
          revision_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requirement_revisions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "customer_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requirements: {
        Row: {
          approved_at: string | null
          created_at: string
          created_by: string | null
          current_revision: number
          customer_id: string
          customer_reference: string | null
          id: string
          opportunity_id: string
          requirement_data: Json
          requirement_number: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          current_revision?: number
          customer_id: string
          customer_reference?: string | null
          id?: string
          opportunity_id: string
          requirement_data?: Json
          requirement_number?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          current_revision?: number
          customer_id?: string
          customer_reference?: string | null
          id?: string
          opportunity_id?: string
          requirement_data?: Json
          requirement_number?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requirements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_returns: {
        Row: {
          complaint_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          disposition: string | null
          id: string
          production_unit_id: string | null
          received_date: string | null
          return_code: string
          return_reason: string | null
          status: string
          updated_at: string
          warranty_claim_id: string | null
        }
        Insert: {
          complaint_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          disposition?: string | null
          id?: string
          production_unit_id?: string | null
          received_date?: string | null
          return_code: string
          return_reason?: string | null
          status?: string
          updated_at?: string
          warranty_claim_id?: string | null
        }
        Update: {
          complaint_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          disposition?: string | null
          id?: string
          production_unit_id?: string | null
          received_date?: string | null
          return_code?: string
          return_reason?: string | null
          status?: string
          updated_at?: string
          warranty_claim_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_returns_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_warranty_claim_id_fkey"
            columns: ["warranty_claim_id"]
            isOneToOne: false
            referencedRelation: "customer_warranty_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_satisfaction_surveys: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string | null
          evidence_reference: string | null
          feedback: string | null
          id: string
          period_end: string | null
          period_start: string | null
          score: number | null
          status: string
          survey_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          evidence_reference?: string | null
          feedback?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          score?: number | null
          status?: string
          survey_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          evidence_reference?: string | null
          feedback?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          score?: number | null
          status?: string
          survey_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_satisfaction_surveys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_warranty_claims: {
        Row: {
          claim_code: string
          claim_summary: string
          complaint_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          eligibility_notes: string | null
          eligibility_status: string
          id: string
          owner_user_id: string | null
          production_unit_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claim_code: string
          claim_summary: string
          complaint_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          eligibility_notes?: string | null
          eligibility_status?: string
          id?: string
          owner_user_id?: string | null
          production_unit_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claim_code?: string
          claim_summary?: string
          complaint_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          eligibility_notes?: string | null
          eligibility_status?: string
          id?: string
          owner_user_id?: string | null
          production_unit_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_warranty_claims_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_warranty_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_warranty_claims_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_owner_user_id: string | null
          billing_address: string | null
          created_at: string
          created_by: string | null
          customer_code: string
          customer_type: string
          display_name: string | null
          id: string
          industry: string | null
          legal_name: string
          notes: string | null
          primary_email: string | null
          primary_phone: string | null
          shipping_address: string | null
          status: string
          tax_identifier: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_owner_user_id?: string | null
          billing_address?: string | null
          created_at?: string
          created_by?: string | null
          customer_code: string
          customer_type?: string
          display_name?: string | null
          id?: string
          industry?: string | null
          legal_name: string
          notes?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          shipping_address?: string | null
          status?: string
          tax_identifier?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_owner_user_id?: string | null
          billing_address?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string
          customer_type?: string
          display_name?: string | null
          id?: string
          industry?: string | null
          legal_name?: string
          notes?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          shipping_address?: string | null
          status?: string
          tax_identifier?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      data_provenance: {
        Row: {
          confidence: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          fetched_at: string
          field_key: string
          id: string
          last_verified_at: string | null
          override_by: string | null
          override_reason: string | null
          override_value: Json | null
          provider: string | null
          source_identifier: string | null
          source_kind: string
          source_url: string | null
          state: string
          updated_at: string
          value_snapshot: Json | null
        }
        Insert: {
          confidence?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          fetched_at?: string
          field_key: string
          id?: string
          last_verified_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          override_value?: Json | null
          provider?: string | null
          source_identifier?: string | null
          source_kind: string
          source_url?: string | null
          state?: string
          updated_at?: string
          value_snapshot?: Json | null
        }
        Update: {
          confidence?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          fetched_at?: string
          field_key?: string
          id?: string
          last_verified_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          override_value?: Json | null
          provider?: string | null
          source_identifier?: string | null
          source_kind?: string
          source_url?: string | null
          state?: string
          updated_at?: string
          value_snapshot?: Json | null
        }
        Relationships: []
      }
      datasheet_cache: {
        Row: {
          datasheet_url: string | null
          manufacturer: string
          mpn: string
          resolved_at: string
          source: string
        }
        Insert: {
          datasheet_url?: string | null
          manufacturer?: string
          mpn: string
          resolved_at?: string
          source: string
        }
        Update: {
          datasheet_url?: string | null
          manufacturer?: string
          mpn?: string
          resolved_at?: string
          source?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          aliases: string[]
          code: string | null
          color: string | null
          created_at: string
          department_lead_user_id: string | null
          description: string | null
          document_code_enabled: boolean
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_department_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          code?: string | null
          color?: string | null
          created_at?: string
          department_lead_user_id?: string | null
          description?: string | null
          document_code_enabled?: boolean
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_department_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          code?: string | null
          color?: string | null
          created_at?: string
          department_lead_user_id?: string | null
          description?: string | null
          document_code_enabled?: boolean
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_department_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_numbering_config: {
        Row: {
          created_at: string
          current_sequence: number
          entity_type: string | null
          id: string
          include_department: boolean
          include_project: boolean
          include_year: boolean
          is_active: boolean
          key: string
          label: string
          metadata: Json
          prefix_template: string
          reset_policy: string
          separator: string
          serial_padding: number
          starting_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_sequence?: number
          entity_type?: string | null
          id?: string
          include_department?: boolean
          include_project?: boolean
          include_year?: boolean
          is_active?: boolean
          key: string
          label: string
          metadata?: Json
          prefix_template: string
          reset_policy?: string
          separator?: string
          serial_padding?: number
          starting_number?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_sequence?: number
          entity_type?: string | null
          id?: string
          include_department?: boolean
          include_project?: boolean
          include_year?: boolean
          is_active?: boolean
          key?: string
          label?: string
          metadata?: Json
          prefix_template?: string
          reset_policy?: string
          separator?: string
          serial_padding?: number
          starting_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      drive_node_revisions: {
        Row: {
          change_summary: string | null
          created_at: string
          file_size_bytes: number
          id: string
          node_id: string
          sha256_checksum: string | null
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          file_size_bytes?: number
          id?: string
          node_id: string
          sha256_checksum?: string | null
          storage_path: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          file_size_bytes?: number
          id?: string
          node_id?: string
          sha256_checksum?: string | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "drive_node_revisions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_nodes: {
        Row: {
          created_at: string
          created_by: string | null
          current_version: number
          file_size_bytes: number | null
          file_type: string | null
          id: string
          is_locked: boolean
          is_starred: boolean
          is_trashed: boolean
          metadata: Json
          mime_type: string | null
          name: string
          node_type: string
          parent_id: string | null
          project_id: string | null
          sha256_checksum: string | null
          slug: string
          starred_reason: string | null
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version?: number
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          is_locked?: boolean
          is_starred?: boolean
          is_trashed?: boolean
          metadata?: Json
          mime_type?: string | null
          name: string
          node_type: string
          parent_id?: string | null
          project_id?: string | null
          sha256_checksum?: string | null
          slug: string
          starred_reason?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version?: number
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          is_locked?: boolean
          is_starred?: boolean
          is_trashed?: boolean
          metadata?: Json
          mime_type?: string | null
          name?: string
          node_type?: string
          parent_id?: string | null
          project_id?: string | null
          sha256_checksum?: string | null
          slug?: string
          starred_reason?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          node_id: string
          permission_level: string
          revoked_at: string | null
          share_token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          node_id: string
          permission_level: string
          revoked_at?: string | null
          share_token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          node_id?: string
          permission_level?: string
          revoked_at?: string | null
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_share_links_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_user_favorites: {
        Row: {
          created_at: string
          node_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          node_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          node_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_user_favorites_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_access_roles: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          employee_id: string
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          employee_id: string
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          employee_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_access_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_access_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_departments: {
        Row: {
          created_at: string
          department_id: string
          employee_id: string
          is_primary: boolean
        }
        Insert: {
          created_at?: string
          department_id: string
          employee_id: string
          is_primary?: boolean
        }
        Update: {
          created_at?: string
          department_id?: string
          employee_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_departments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          current_work_location: string | null
          date_of_joining: string | null
          default_role_id: string | null
          department_lead_user_id: string | null
          designation: string | null
          display_name: string | null
          employee_code: string | null
          employment_status: string
          first_name: string | null
          id: string
          last_name: string | null
          official_email: string | null
          onboarding_completed_at: string | null
          personal_email: string | null
          phone: string | null
          primary_department_id: string | null
          profile_photo_url: string | null
          reporting_manager_user_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_work_location?: string | null
          date_of_joining?: string | null
          default_role_id?: string | null
          department_lead_user_id?: string | null
          designation?: string | null
          display_name?: string | null
          employee_code?: string | null
          employment_status?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          official_email?: string | null
          onboarding_completed_at?: string | null
          personal_email?: string | null
          phone?: string | null
          primary_department_id?: string | null
          profile_photo_url?: string | null
          reporting_manager_user_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_work_location?: string | null
          date_of_joining?: string | null
          default_role_id?: string | null
          department_lead_user_id?: string | null
          designation?: string | null
          display_name?: string | null
          employee_code?: string | null
          employment_status?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          official_email?: string | null
          onboarding_completed_at?: string | null
          personal_email?: string | null
          phone?: string | null
          primary_department_id?: string | null
          profile_photo_url?: string | null
          reporting_manager_user_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_primary_department_id_fkey"
            columns: ["primary_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_registry: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          permalink: string
          qr_payload: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          permalink: string
          qr_payload: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          permalink?: string
          qr_payload?: string
        }
        Relationships: []
      }
      external_access_events: {
        Row: {
          entity_id: string | null
          entity_type: string
          event_type: string
          external_contact_id: string | null
          external_party_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          snapshot_id: string | null
        }
        Insert: {
          entity_id?: string | null
          entity_type: string
          event_type: string
          external_contact_id?: string | null
          external_party_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          snapshot_id?: string | null
        }
        Update: {
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          external_contact_id?: string | null
          external_party_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_access_events_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_events_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_access_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "external_share_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      external_actions: {
        Row: {
          action_code: string | null
          attachments: Json
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          external_contact_id: string | null
          external_party_id: string
          id: string
          project_id: string | null
          response: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_code?: string | null
          attachments?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          external_contact_id?: string | null
          external_party_id: string
          id?: string
          project_id?: string | null
          response?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_code?: string | null
          attachments?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          external_contact_id?: string | null
          external_party_id?: string
          id?: string
          project_id?: string | null
          response?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_actions_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_actions_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_api_clients: {
        Row: {
          active: boolean
          client_key_hint: string
          client_name: string
          client_secret_hash: string | null
          client_secret_rotated_at: string | null
          created_at: string
          created_by: string | null
          external_party_id: string | null
          id: string
          last_used_at: string | null
          scopes: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_key_hint: string
          client_name: string
          client_secret_hash?: string | null
          client_secret_rotated_at?: string | null
          created_at?: string
          created_by?: string | null
          external_party_id?: string | null
          id?: string
          last_used_at?: string | null
          scopes?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_key_hint?: string
          client_name?: string
          client_secret_hash?: string | null
          client_secret_rotated_at?: string | null
          created_at?: string
          created_by?: string | null
          external_party_id?: string | null
          id?: string
          last_used_at?: string | null
          scopes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_api_clients_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_contacts: {
        Row: {
          active: boolean
          contact_code: string | null
          contact_role: string | null
          created_at: string
          created_by: string | null
          customer_contact_id: string | null
          designation: string | null
          email: string
          external_party_id: string
          full_name: string
          id: string
          last_login_at: string | null
          notes: string | null
          phone: string | null
          portal_enabled: boolean
          preferred_language: string
          timezone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          contact_code?: string | null
          contact_role?: string | null
          created_at?: string
          created_by?: string | null
          customer_contact_id?: string | null
          designation?: string | null
          email: string
          external_party_id: string
          full_name: string
          id?: string
          last_login_at?: string | null
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          preferred_language?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          contact_code?: string | null
          contact_role?: string | null
          created_at?: string
          created_by?: string | null
          customer_contact_id?: string | null
          designation?: string | null
          email?: string
          external_party_id?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          preferred_language?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_contacts_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_contacts_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_data_cache: {
        Row: {
          cache_key: string
          created_at: string
          error_message: string | null
          expires_at: string | null
          fetched_at: string
          id: string
          last_verified_at: string | null
          payload: Json
          provider: string
          source_identifier: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: string
          last_verified_at?: string | null
          payload: Json
          provider: string
          source_identifier?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: string
          last_verified_at?: string | null
          payload?: Json
          provider?: string
          source_identifier?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_data_room_items: {
        Row: {
          category: string
          created_at: string
          data_room_id: string
          id: string
          is_favorite_eligible: boolean
          revision_reference: string | null
          source_entity_id: string
          source_entity_type: string
        }
        Insert: {
          category?: string
          created_at?: string
          data_room_id: string
          id?: string
          is_favorite_eligible?: boolean
          revision_reference?: string | null
          source_entity_id: string
          source_entity_type: string
        }
        Update: {
          category?: string
          created_at?: string
          data_room_id?: string
          id?: string
          is_favorite_eligible?: boolean
          revision_reference?: string | null
          source_entity_id?: string
          source_entity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_data_room_items_data_room_id_fkey"
            columns: ["data_room_id"]
            isOneToOne: false
            referencedRelation: "external_data_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      external_data_rooms: {
        Row: {
          confidentiality_classification: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          external_party_id: string
          id: string
          nda_required: boolean
          project_id: string | null
          room_code: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          confidentiality_classification?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          external_party_id: string
          id?: string
          nda_required?: boolean
          project_id?: string | null
          room_code?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          confidentiality_classification?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          external_party_id?: string
          id?: string
          nda_required?: boolean
          project_id?: string | null
          room_code?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_data_rooms_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_data_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_integrations: {
        Row: {
          authentication_kind: string
          created_at: string
          created_by: string | null
          health_status: string
          id: string
          is_enabled: boolean
          last_error: string | null
          last_synced_at: string | null
          metadata: Json
          provenance_note: string | null
          provider: string
          purpose: string
          rate_limit_note: string | null
          scope_description: string | null
          updated_at: string
        }
        Insert: {
          authentication_kind?: string
          created_at?: string
          created_by?: string | null
          health_status?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provenance_note?: string | null
          provider: string
          purpose: string
          rate_limit_note?: string | null
          scope_description?: string | null
          updated_at?: string
        }
        Update: {
          authentication_kind?: string
          created_at?: string
          created_by?: string | null
          health_status?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provenance_note?: string | null
          provider?: string
          purpose?: string
          rate_limit_note?: string | null
          scope_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      external_parties: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          customer_id: string | null
          display_name: string
          id: string
          notes: string | null
          party_code: string | null
          party_type: string
          portal_required: boolean
          portal_title: string | null
          preferred_language: string
          support_email: string | null
          timezone: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          display_name: string
          id?: string
          notes?: string | null
          party_code?: string | null
          party_type: string
          portal_required?: boolean
          portal_title?: string | null
          preferred_language?: string
          support_email?: string | null
          timezone?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          display_name?: string
          id?: string
          notes?: string | null
          party_code?: string | null
          party_type?: string
          portal_required?: boolean
          portal_title?: string | null
          preferred_language?: string
          support_email?: string | null
          timezone?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_parties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_parties_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      external_portal_access: {
        Row: {
          access_role: string
          access_scope: Json
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          expires_at: string | null
          external_contact_id: string
          id: string
          invitation_accepted_at: string | null
          invitation_revoked_at: string | null
          invitation_sent_at: string | null
          invitation_token: string
          invited_by: string | null
          is_active: boolean
          portal_type: string
          updated_at: string
        }
        Insert: {
          access_role: string
          access_scope?: Json
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expires_at?: string | null
          external_contact_id: string
          id?: string
          invitation_accepted_at?: string | null
          invitation_revoked_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string
          invited_by?: string | null
          is_active?: boolean
          portal_type: string
          updated_at?: string
        }
        Update: {
          access_role?: string
          access_scope?: Json
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expires_at?: string | null
          external_contact_id?: string
          id?: string
          invitation_accepted_at?: string | null
          invitation_revoked_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string
          invited_by?: string | null
          is_active?: boolean
          portal_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_portal_access_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_review_requests: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          external_contact_id: string | null
          external_party_id: string
          id: string
          request_type: string
          responded_at: string | null
          response: string | null
          response_metadata: Json
          revision_reference: string | null
          source_entity_id: string
          source_entity_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_contact_id?: string | null
          external_party_id: string
          id?: string
          request_type: string
          responded_at?: string | null
          response?: string | null
          response_metadata?: Json
          revision_reference?: string | null
          source_entity_id: string
          source_entity_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_contact_id?: string | null
          external_party_id?: string
          id?: string
          request_type?: string
          responded_at?: string | null
          response?: string | null
          response_metadata?: Json
          revision_reference?: string | null
          source_entity_id?: string
          source_entity_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_review_requests_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_review_requests_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_share_snapshots: {
        Row: {
          checksum: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          external_party_id: string
          id: string
          manifest: Json
          permission: string
          recipient_email: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          share_mode: string
          snapshot_code: string | null
          source_entity_id: string
          source_entity_type: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          external_party_id: string
          id?: string
          manifest?: Json
          permission?: string
          recipient_email?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          share_mode?: string
          snapshot_code?: string | null
          source_entity_id: string
          source_entity_type: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          external_party_id?: string
          id?: string
          manifest?: Json
          permission?: string
          recipient_email?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          share_mode?: string
          snapshot_code?: string | null
          source_entity_id?: string
          source_entity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_share_snapshots_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_transmittals: {
        Row: {
          acknowledged_by_contact_id: string | null
          created_at: string
          created_by: string | null
          document_manifest: Json
          due_date: string | null
          external_party_id: string
          id: string
          issued_at: string | null
          message: string | null
          project_id: string | null
          purpose: string
          received_at: string | null
          required_action: string
          status: string
          transmittal_number: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_by_contact_id?: string | null
          created_at?: string
          created_by?: string | null
          document_manifest?: Json
          due_date?: string | null
          external_party_id: string
          id?: string
          issued_at?: string | null
          message?: string | null
          project_id?: string | null
          purpose: string
          received_at?: string | null
          required_action?: string
          status?: string
          transmittal_number?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_by_contact_id?: string | null
          created_at?: string
          created_by?: string | null
          document_manifest?: Json
          due_date?: string | null
          external_party_id?: string
          id?: string
          issued_at?: string | null
          message?: string | null
          project_id?: string | null
          purpose?: string
          received_at?: string | null
          required_action?: string
          status?: string
          transmittal_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_transmittals_acknowledged_by_contact_id_fkey"
            columns: ["acknowledged_by_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_transmittals_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_transmittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_upload_requests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          destination: string | null
          due_date: string | null
          expected_format: string | null
          external_contact_id: string | null
          external_party_id: string
          id: string
          request_code: string | null
          requested_document: string
          required_metadata: Json
          source_entity_id: string | null
          source_entity_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination?: string | null
          due_date?: string | null
          expected_format?: string | null
          external_contact_id?: string | null
          external_party_id: string
          id?: string
          request_code?: string | null
          requested_document: string
          required_metadata?: Json
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination?: string | null
          due_date?: string | null
          expected_format?: string | null
          external_contact_id?: string | null
          external_party_id?: string
          id?: string
          request_code?: string | null
          requested_document?: string
          required_metadata?: Json
          source_entity_id?: string | null
          source_entity_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_upload_requests_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_upload_requests_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_uploads: {
        Row: {
          accepted_drive_node_id: string | null
          checksum: string | null
          created_at: string
          external_contact_id: string | null
          external_party_id: string
          file_size: number | null
          id: string
          metadata: Json
          mime_type: string | null
          original_filename: string
          request_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          updated_at: string
          upload_code: string | null
        }
        Insert: {
          accepted_drive_node_id?: string | null
          checksum?: string | null
          created_at?: string
          external_contact_id?: string | null
          external_party_id: string
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_filename: string
          request_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          upload_code?: string | null
        }
        Update: {
          accepted_drive_node_id?: string | null
          checksum?: string | null
          created_at?: string
          external_contact_id?: string | null
          external_party_id?: string
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_filename?: string
          request_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          upload_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_uploads_accepted_drive_node_id_fkey"
            columns: ["accepted_drive_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_uploads_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_uploads_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_uploads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "external_upload_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      external_webhook_deliveries: {
        Row: {
          attempt_count: number
          attempted_at: string | null
          completed_at: string | null
          created_at: string
          event_key: string
          id: string
          idempotency_key: string
          next_retry_at: string | null
          payload: Json
          response_status: number | null
          response_summary: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          attempt_count?: number
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string
          event_key: string
          id?: string
          idempotency_key: string
          next_retry_at?: string | null
          payload?: Json
          response_status?: number | null
          response_summary?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          attempt_count?: number
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string
          event_key?: string
          id?: string
          idempotency_key?: string
          next_retry_at?: string | null
          payload?: Json
          response_status?: number | null
          response_summary?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "external_webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      external_webhook_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          disabled_at: string | null
          endpoint_url: string
          event_types: Json
          external_party_id: string | null
          failure_count: number
          id: string
          last_delivery_at: string | null
          signing_secret_hash: string | null
          signing_secret_hint: string | null
          signing_secret_rotated_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          endpoint_url: string
          event_types?: Json
          external_party_id?: string | null
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          signing_secret_hash?: string | null
          signing_secret_hint?: string | null
          signing_secret_rotated_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          endpoint_url?: string
          event_types?: Json
          external_party_id?: string | null
          failure_count?: number
          id?: string
          last_delivery_at?: string | null
          signing_secret_hash?: string | null
          signing_secret_hint?: string | null
          signing_secret_rotated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_webhook_subscriptions_external_party_id_fkey"
            columns: ["external_party_id"]
            isOneToOne: false
            referencedRelation: "external_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_location_responsibilities: {
        Row: {
          active_from: string
          active_to: string | null
          created_at: string
          facility_location_id: string
          id: string
          responsibility_type: string
          user_id: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          facility_location_id: string
          id?: string
          responsibility_type?: string
          user_id: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          facility_location_id?: string
          id?: string
          responsibility_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_location_responsibilities_facility_location_id_fkey"
            columns: ["facility_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_locations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          location_type: string
          metadata: Json
          name: string
          parent_id: string | null
          qr_payload: string
          responsible_user_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location_type: string
          metadata?: Json
          name: string
          parent_id?: string | null
          qr_payload: string
          responsible_user_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          location_type?: string
          metadata?: Json
          name?: string
          parent_id?: string | null
          qr_payload?: string
          responsible_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          component_id: string
          created_at: string
          date_code: string | null
          grn_id: string
          id: string
          location_id: string | null
          lot_number: string | null
          po_item_id: string | null
          quality_status: string
          quantity_received: number
          quantity_rejected: number
          reel_id: string | null
          rejection_note: string | null
          rejection_reason: string | null
        }
        Insert: {
          component_id: string
          created_at?: string
          date_code?: string | null
          grn_id: string
          id?: string
          location_id?: string | null
          lot_number?: string | null
          po_item_id?: string | null
          quality_status?: string
          quantity_received: number
          quantity_rejected?: number
          reel_id?: string | null
          rejection_note?: string | null
          rejection_reason?: string | null
        }
        Update: {
          component_id?: string
          created_at?: string
          date_code?: string | null
          grn_id?: string
          id?: string
          location_id?: string | null
          lot_number?: string | null
          po_item_id?: string | null
          quality_status?: string
          quantity_received?: number
          quantity_rejected?: number
          reel_id?: string | null
          rejection_note?: string | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_notes: {
        Row: {
          barcode_payload: string | null
          created_at: string
          grn_number: string
          id: string
          po_id: string | null
          quality_status: string
          received_by: string | null
          storage_location_notes: string | null
          vendor_invoice_date: string | null
          vendor_invoice_number: string
        }
        Insert: {
          barcode_payload?: string | null
          created_at?: string
          grn_number: string
          id?: string
          po_id?: string | null
          quality_status?: string
          received_by?: string | null
          storage_location_notes?: string | null
          vendor_invoice_date?: string | null
          vendor_invoice_number: string
        }
        Update: {
          barcode_payload?: string | null
          created_at?: string
          grn_number?: string
          id?: string
          po_id?: string | null
          quality_status?: string
          received_by?: string | null
          storage_location_notes?: string | null
          vendor_invoice_date?: string | null
          vendor_invoice_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_applications: {
        Row: {
          candidate_id: string
          cover_letter: string | null
          created_at: string
          id: string
          posting_id: string
          public_status_token: string
          stage: string
          status: string
          submitted_at: string
          submitted_via: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          posting_id: string
          public_status_token?: string
          stage?: string
          status?: string
          submitted_at?: string
          submitted_via?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          posting_id?: string
          public_status_token?: string
          stage?: string
          status?: string
          submitted_at?: string
          submitted_via?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_applications_posting_id_fkey"
            columns: ["posting_id"]
            isOneToOne: false
            referencedRelation: "hr_job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_assessments: {
        Row: {
          application_id: string
          assigned_by: string | null
          created_at: string
          due_at: string | null
          id: string
          instructions: string | null
          reviewer_notes: string | null
          score: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id: string
          assigned_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          reviewer_notes?: string | null
          score?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          assigned_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          reviewer_notes?: string | null
          score?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_assessments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hr_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_candidates: {
        Row: {
          candidate_code: string | null
          confirmed_profile: Json
          created_at: string
          created_by: string | null
          current_location: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          parsed_resume: Json
          phone: string | null
          resume_file_size: number | null
          resume_filename: string | null
          resume_mime_type: string | null
          resume_storage_path: string | null
          source: string
          updated_at: string
        }
        Insert: {
          candidate_code?: string | null
          confirmed_profile?: Json
          created_at?: string
          created_by?: string | null
          current_location?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          parsed_resume?: Json
          phone?: string | null
          resume_file_size?: number | null
          resume_filename?: string | null
          resume_mime_type?: string | null
          resume_storage_path?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          candidate_code?: string | null
          confirmed_profile?: Json
          created_at?: string
          created_by?: string | null
          current_location?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          parsed_resume?: Json
          phone?: string | null
          resume_file_size?: number | null
          resume_filename?: string | null
          resume_mime_type?: string | null
          resume_storage_path?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_employee_onboarding_items: {
        Row: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_required: boolean
          onboarding_id: string
          owner_kind: string
          owner_user_id: string | null
          sort_order: number
          source_item_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          onboarding_id: string
          owner_kind?: string
          owner_user_id?: string | null
          sort_order?: number
          source_item_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          onboarding_id?: string
          owner_kind?: string
          owner_user_id?: string | null
          sort_order?: number
          source_item_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_onboarding_items_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "hr_employee_onboardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_onboarding_items_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "hr_onboarding_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employee_onboardings: {
        Row: {
          application_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          plan_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          welcome_kit_notes: string | null
          welcome_kit_status: string
        }
        Insert: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          plan_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          welcome_kit_notes?: string | null
          welcome_kit_status?: string
        }
        Update: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          plan_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          welcome_kit_notes?: string | null
          welcome_kit_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_onboardings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "hr_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_onboardings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_onboardings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hr_onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interview_feedback: {
        Row: {
          concerns: string | null
          created_at: string
          id: string
          interviewer_user_id: string
          rating: number | null
          recommendation: string | null
          round_id: string
          strengths: string | null
          submitted_at: string | null
        }
        Insert: {
          concerns?: string | null
          created_at?: string
          id?: string
          interviewer_user_id: string
          rating?: number | null
          recommendation?: string | null
          round_id: string
          strengths?: string | null
          submitted_at?: string | null
        }
        Update: {
          concerns?: string | null
          created_at?: string
          id?: string
          interviewer_user_id?: string
          rating?: number | null
          recommendation?: string | null
          round_id?: string
          strengths?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_feedback_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hr_interview_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interview_rounds: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          id: string
          interviewer_user_id: string
          meeting_notes: string | null
          scheduled_for: string | null
          scorecard: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interviewer_user_id: string
          meeting_notes?: string | null
          scheduled_for?: string | null
          scorecard?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interviewer_user_id?: string
          meeting_notes?: string | null
          scheduled_for?: string | null
          scorecard?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_rounds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hr_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_job_postings: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string
          employment_type: string
          id: string
          is_published: boolean
          job_code: string | null
          location: string | null
          published_at: string | null
          requisition_id: string | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
          work_mode: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description: string
          employment_type?: string
          id?: string
          is_published?: boolean
          job_code?: string | null
          location?: string | null
          published_at?: string | null
          requisition_id?: string | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          work_mode?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          employment_type?: string
          id?: string
          is_published?: boolean
          job_code?: string | null
          location?: string | null
          published_at?: string | null
          requisition_id?: string | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_job_postings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_postings_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "hr_job_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_job_profiles: {
        Row: {
          assessment_template: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          designation: string | null
          education: string | null
          experience: string | null
          id: string
          interview_template: string | null
          is_active: boolean
          job_description: string | null
          preferred_skills: string | null
          profile_name: string
          required_skills: string | null
          responsibilities: string | null
          updated_at: string
        }
        Insert: {
          assessment_template?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          designation?: string | null
          education?: string | null
          experience?: string | null
          id?: string
          interview_template?: string | null
          is_active?: boolean
          job_description?: string | null
          preferred_skills?: string | null
          profile_name: string
          required_skills?: string | null
          responsibilities?: string | null
          updated_at?: string
        }
        Update: {
          assessment_template?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          designation?: string | null
          education?: string | null
          experience?: string | null
          id?: string
          interview_template?: string | null
          is_active?: boolean
          job_description?: string | null
          preferred_skills?: string | null
          profile_name?: string
          required_skills?: string | null
          responsibilities?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_job_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_job_requisitions: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          employment_type: string
          headcount: number
          hiring_manager_user_id: string | null
          id: string
          job_profile_id: string | null
          justification: string | null
          location: string | null
          requisition_code: string | null
          status: string
          target_start_date: string | null
          title: string
          updated_at: string
          work_mode: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employment_type?: string
          headcount?: number
          hiring_manager_user_id?: string | null
          id?: string
          job_profile_id?: string | null
          justification?: string | null
          location?: string | null
          requisition_code?: string | null
          status?: string
          target_start_date?: string | null
          title: string
          updated_at?: string
          work_mode?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employment_type?: string
          headcount?: number
          hiring_manager_user_id?: string | null
          id?: string
          job_profile_id?: string | null
          justification?: string | null
          location?: string | null
          requisition_code?: string | null
          status?: string
          target_start_date?: string | null
          title?: string
          updated_at?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_job_requisitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_requisitions_job_profile_id_fkey"
            columns: ["job_profile_id"]
            isOneToOne: false
            referencedRelation: "hr_job_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_balances: {
        Row: {
          balance: number
          consumed: number
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          updated_at: string
          year: number
        }
        Insert: {
          balance?: number
          consumed?: number
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          updated_at?: string
          year: number
        }
        Update: {
          balance?: number
          consumed?: number
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          acted_at: string | null
          approver_note: string | null
          approver_user_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
        }
        Insert: {
          acted_at?: string | null
          approver_note?: string | null
          approver_user_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          start_date: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          acted_at?: string | null
          approver_note?: string | null
          approver_user_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_types: {
        Row: {
          annual_quota: number
          code: string
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          requires_approval: boolean
          updated_at: string
        }
        Insert: {
          annual_quota?: number
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          requires_approval?: boolean
          updated_at?: string
        }
        Update: {
          annual_quota?: number
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          requires_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hr_offers: {
        Row: {
          application_id: string
          approved_by: string | null
          compensation: Json
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          approved_by?: string | null
          compensation?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          approved_by?: string | null
          compensation?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "hr_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_items: {
        Row: {
          created_at: string
          description: string | null
          due_offset_days: number
          id: string
          is_required: boolean
          owner_kind: string
          plan_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_offset_days?: number
          id?: string
          is_required?: boolean
          owner_kind?: string
          plan_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_offset_days?: number
          id?: string
          is_required?: boolean
          owner_kind?: string
          plan_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hr_onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_plans: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_policies: {
        Row: {
          created_at: string
          created_by: string | null
          document_node_id: string | null
          id: string
          is_active: boolean
          policy_code: string
          published_at: string | null
          summary: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_node_id?: string | null
          id?: string
          is_active?: boolean
          policy_code: string
          published_at?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_node_id?: string | null
          id?: string
          is_active?: boolean
          policy_code?: string
          published_at?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_policies_document_node_id_fkey"
            columns: ["document_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_policy_acknowledgements: {
        Row: {
          acknowledged_at: string
          created_at: string
          employee_id: string
          id: string
          policy_id: string
        }
        Insert: {
          acknowledged_at?: string
          created_at?: string
          employee_id: string
          id?: string
          policy_id: string
        }
        Update: {
          acknowledged_at?: string
          created_at?: string
          employee_id?: string
          id?: string
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_policy_acknowledgements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_policy_acknowledgements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "hr_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_training_enrollments: {
        Row: {
          certificate_storage_path: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          employee_id: string
          id: string
          program_id: string
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          certificate_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          employee_id: string
          id?: string
          program_id: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_storage_path?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          program_id?: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_training_enrollments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_training_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "hr_training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_training_programs: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_mode: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_training_programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      imte_instruments: {
        Row: {
          accuracy: string | null
          asset_id: string
          calibration_interval_days: number
          calibration_status: string
          created_at: string
          created_by: string | null
          id: string
          instrument_code: string
          least_count: string | null
          measurement_range: string | null
          next_calibration_due: string
          qr_payload: string
          updated_at: string
        }
        Insert: {
          accuracy?: string | null
          asset_id: string
          calibration_interval_days?: number
          calibration_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instrument_code: string
          least_count?: string | null
          measurement_range?: string | null
          next_calibration_due: string
          qr_payload: string
          updated_at?: string
        }
        Update: {
          accuracy?: string | null
          asset_id?: string
          calibration_interval_days?: number
          calibration_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instrument_code?: string
          least_count?: string | null
          measurement_range?: string | null
          next_calibration_due?: string
          qr_payload?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imte_instruments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_inspections: {
        Row: {
          applicability_reason: string | null
          created_at: string
          disposition_at: string | null
          disposition_by: string | null
          evidence_path: string | null
          findings: string | null
          grn_id: string
          grn_item_id: string
          id: string
          sampling_plan: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          applicability_reason?: string | null
          created_at?: string
          disposition_at?: string | null
          disposition_by?: string | null
          evidence_path?: string | null
          findings?: string | null
          grn_id: string
          grn_item_id: string
          id?: string
          sampling_plan?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          applicability_reason?: string | null
          created_at?: string
          disposition_at?: string | null
          disposition_by?: string | null
          evidence_path?: string | null
          findings?: string | null
          grn_id?: string
          grn_item_id?: string
          id?: string
          sampling_plan?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_inspections_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_inspections_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: true
            referencedRelation: "goods_receipt_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_inspections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          component_id: string
          created_at: string
          date_code: string | null
          expiry_date: string | null
          grn_item_id: string | null
          id: string
          location_id: string | null
          lot_number: string | null
          quality_status: string
          quantity_available: number
          quantity_received: number
          reel_id: string | null
          updated_at: string
        }
        Insert: {
          component_id: string
          created_at?: string
          date_code?: string | null
          expiry_date?: string | null
          grn_item_id?: string | null
          id?: string
          location_id?: string | null
          lot_number?: string | null
          quality_status?: string
          quantity_available?: number
          quantity_received?: number
          reel_id?: string | null
          updated_at?: string
        }
        Update: {
          component_id?: string
          created_at?: string
          date_code?: string | null
          expiry_date?: string | null
          grn_item_id?: string | null
          id?: string
          location_id?: string | null
          lot_number?: string | null
          quality_status?: string
          quantity_available?: number
          quantity_received?: number
          reel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          component_id: string
          created_at: string
          created_by: string
          id: string
          lot_id: string | null
          project_id: string | null
          quantity: number
          source_entity_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          component_id: string
          created_at?: string
          created_by?: string
          id?: string
          lot_id?: string | null
          project_id?: string | null
          quantity: number
          source_entity_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          component_id?: string
          created_at?: string
          created_by?: string
          id?: string
          lot_id?: string | null
          project_id?: string | null
          quantity?: number
          source_entity_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transaction_requests: {
        Row: {
          completed_at: string
          created_at: string
          payload_hash: string
          request_key: string
          requested_by: string
          result: Json
          status: string
          transaction_type: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          payload_hash: string
          request_key: string
          requested_by: string
          result: Json
          status?: string
          transaction_type: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          payload_hash?: string
          request_key?: string
          requested_by?: string
          result?: Json
          status?: string
          transaction_type?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          component_id: string
          created_at: string
          id: string
          label: string
          location_type: string
          quantity: number
          updated_at: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          label: string
          location_type: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          label?: string
          location_type?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          asset_id: string
          checklist: Json
          created_at: string
          created_by: string | null
          frequency_days: number
          id: string
          is_active: boolean
          next_due_date: string
          plan_code: string
          strategy: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          checklist?: Json
          created_at?: string
          created_by?: string | null
          frequency_days: number
          id?: string
          is_active?: boolean
          next_due_date: string
          plan_code: string
          strategy: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          checklist?: Json
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          next_due_date?: string
          plan_code?: string
          strategy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_work_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          plan_id: string | null
          priority: string
          status: string
          updated_at: string
          work_order_code: string
          work_type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          plan_id?: string | null
          priority?: string
          status?: string
          updated_at?: string
          work_order_code: string
          work_type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          plan_id?: string | null
          priority?: string
          status?: string
          updated_at?: string
          work_order_code?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_work_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      material_gate_passes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_id: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          pass_code: string
          pass_type: string
          purpose: string
          qr_payload: string
          released_at: string | null
          return_due_date: string | null
          returned_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          pass_code: string
          pass_type: string
          purpose: string
          qr_payload: string
          released_at?: string | null
          return_due_date?: string | null
          returned_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          pass_code?: string
          pass_type?: string
          purpose?: string
          qr_payload?: string
          released_at?: string | null
          return_due_date?: string | null
          returned_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_gate_passes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      material_issues: {
        Row: {
          assignee_id: string
          assignment_batch_id: string | null
          id: string
          issue_number: string
          issued_at: string
          issued_by: string
          notes: string | null
          project_id: string | null
          project_name: string | null
          request_key: string
        }
        Insert: {
          assignee_id: string
          assignment_batch_id?: string | null
          id?: string
          issue_number: string
          issued_at?: string
          issued_by: string
          notes?: string | null
          project_id?: string | null
          project_name?: string | null
          request_key: string
        }
        Update: {
          assignee_id?: string
          assignment_batch_id?: string | null
          id?: string
          issue_number?: string
          issued_at?: string
          issued_by?: string
          notes?: string | null
          project_id?: string | null
          project_name?: string | null
          request_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_issues_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "rd_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issues_assignment_batch_id_fkey"
            columns: ["assignment_batch_id"]
            isOneToOne: false
            referencedRelation: "assignment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_issues_request_key_fkey"
            columns: ["request_key"]
            isOneToOne: true
            referencedRelation: "inventory_transaction_requests"
            referencedColumns: ["request_key"]
          },
        ]
      }
      material_returns: {
        Row: {
          assignment_id: string
          id: string
          quantity: number
          request_key: string
          return_number: string
          returned_at: string
          returned_by: string
        }
        Insert: {
          assignment_id: string
          id?: string
          quantity: number
          request_key: string
          return_number: string
          returned_at?: string
          returned_by: string
        }
        Update: {
          assignment_id?: string
          id?: string
          quantity?: number
          request_key?: string
          return_number?: string
          returned_at?: string
          returned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_returns_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_returns_request_key_fkey"
            columns: ["request_key"]
            isOneToOne: true
            referencedRelation: "inventory_transaction_requests"
            referencedColumns: ["request_key"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          target_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          target_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          target_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          brand_name: string
          created_at: string
          date_format: string
          default_classification: string
          default_currency: string
          default_email: string | null
          document_branding: Json
          financial_year_start_month: number
          footer_text: string | null
          header_logo_url: string | null
          id: string
          legal_name: string
          logo_url: string | null
          phone: string | null
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_name?: string
          created_at?: string
          date_format?: string
          default_classification?: string
          default_currency?: string
          default_email?: string | null
          document_branding?: Json
          financial_year_start_month?: number
          footer_text?: string | null
          header_logo_url?: string | null
          id?: string
          legal_name?: string
          logo_url?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_name?: string
          created_at?: string
          date_format?: string
          default_classification?: string
          default_currency?: string
          default_email?: string | null
          document_branding?: Json
          financial_year_start_month?: number
          footer_text?: string | null
          header_logo_url?: string | null
          id?: string
          legal_name?: string
          logo_url?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payment_milestones: {
        Row: {
          amount: number
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          basis: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          milestone_type: string
          notes: string | null
          percentage: number | null
          po_id: string | null
          project_id: string | null
          requested_by: string | null
          status: string
          trigger_date: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          basis?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          milestone_type: string
          notes?: string | null
          percentage?: number | null
          po_id?: string | null
          project_id?: string | null
          requested_by?: string | null
          status?: string
          trigger_date?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          basis?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          milestone_type?: string
          notes?: string | null
          percentage?: number | null
          po_id?: string | null
          project_id?: string | null
          requested_by?: string | null
          status?: string
          trigger_date?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_milestones_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_milestones_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      pcb_task_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          task_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          task_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          task_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcb_task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pcb_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pcb_task_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcb_task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pcb_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pcb_task_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pcb_task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pcb_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pcb_tasks: {
        Row: {
          assignee_id: string | null
          board_name: string
          created_at: string
          created_by: string | null
          id: string
          issue: string
          priority: string
          project_id: string | null
          root_cause: string | null
          root_cause_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          board_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue: string
          priority?: string
          project_id?: string | null
          root_cause?: string | null
          root_cause_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          board_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue?: string
          priority?: string
          project_id?: string | null
          root_cause?: string | null
          root_cause_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcb_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "rd_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcb_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          module_key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          module_key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          module_key?: string
        }
        Relationships: []
      }
      po_delivery_revisions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          evidence_path: string | null
          id: string
          original_delivery_date: string | null
          po_id: string
          proposed_by_vendor: boolean
          proposed_delivery_date: string
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          evidence_path?: string | null
          id?: string
          original_delivery_date?: string | null
          po_id: string
          proposed_by_vendor?: boolean
          proposed_delivery_date: string
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          evidence_path?: string | null
          id?: string
          original_delivery_date?: string | null
          po_id?: string
          proposed_by_vendor?: boolean
          proposed_delivery_date?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_delivery_revisions_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_delivery_revisions_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_shipments: {
        Row: {
          awb_number: string | null
          courier: string | null
          created_at: string
          dispatch_date: string | null
          expected_arrival_date: string | null
          id: string
          invoice_path: string | null
          packing_list_path: string | null
          po_id: string
          status: string
          tracking_payload: Json | null
          tracking_provider: string | null
          updated_at: string
        }
        Insert: {
          awb_number?: string | null
          courier?: string | null
          created_at?: string
          dispatch_date?: string | null
          expected_arrival_date?: string | null
          id?: string
          invoice_path?: string | null
          packing_list_path?: string | null
          po_id: string
          status?: string
          tracking_payload?: Json | null
          tracking_provider?: string | null
          updated_at?: string
        }
        Update: {
          awb_number?: string | null
          courier?: string | null
          created_at?: string
          dispatch_date?: string | null
          expected_arrival_date?: string | null
          id?: string
          invoice_path?: string | null
          packing_list_path?: string | null
          po_id?: string
          status?: string
          tracking_payload?: Json | null
          tracking_provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_shipments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_shipments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_dispatch_units: {
        Row: {
          created_at: string
          dispatch_id: string
          id: string
          production_unit_id: string
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          id?: string
          production_unit_id: string
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          id?: string
          production_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_dispatch_units_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "production_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_dispatch_units_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: true
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
        ]
      }
      production_dispatches: {
        Row: {
          carrier_name: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          dispatch_notes: string | null
          dispatch_number: string
          dispatched_at: string | null
          dispatched_by: string | null
          id: string
          recipient_name: string | null
          status: string
          tracking_reference: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          dispatch_notes?: string | null
          dispatch_number: string
          dispatched_at?: string | null
          dispatched_by?: string | null
          id?: string
          recipient_name?: string | null
          status?: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          dispatch_notes?: string | null
          dispatch_number?: string
          dispatched_at?: string | null
          dispatched_by?: string | null
          id?: string
          recipient_name?: string | null
          status?: string
          tracking_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_finished_goods_releases: {
        Row: {
          created_at: string
          created_by: string
          id: string
          packaging_reference: string | null
          production_unit_id: string
          release_notes: string | null
          released_at: string | null
          released_by: string | null
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          packaging_reference?: string | null
          production_unit_id: string
          release_notes?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          packaging_reference?: string | null
          production_unit_id?: string
          release_notes?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_finished_goods_releases_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: true
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_finished_goods_releases_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_in_process_inspections: {
        Row: {
          created_at: string
          findings: string | null
          id: string
          inspected_at: string
          inspected_by: string
          production_unit_id: string
          released_at: string | null
          released_by: string | null
          result: string
          route_step_id: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          findings?: string | null
          id?: string
          inspected_at?: string
          inspected_by?: string
          production_unit_id: string
          released_at?: string | null
          released_by?: string | null
          result: string
          route_step_id?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          findings?: string | null
          id?: string
          inspected_at?: string
          inspected_by?: string
          production_unit_id?: string
          released_at?: string | null
          released_by?: string | null
          result?: string
          route_step_id?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_in_process_inspections_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_in_process_inspections_route_step_id_fkey"
            columns: ["route_step_id"]
            isOneToOne: false
            referencedRelation: "production_route_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_in_process_inspections_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_kit_lines: {
        Row: {
          created_at: string
          created_by: string
          id: string
          inventory_lot_id: string
          kit_id: string
          quantity_picked: number
          quantity_returned: number
          updated_at: string
          work_order_material_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          inventory_lot_id: string
          kit_id: string
          quantity_picked: number
          quantity_returned?: number
          updated_at?: string
          work_order_material_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          inventory_lot_id?: string
          kit_id?: string
          quantity_picked?: number
          quantity_returned?: number
          updated_at?: string
          work_order_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_kit_lines_inventory_lot_id_fkey"
            columns: ["inventory_lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_kit_lines_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "production_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_kit_lines_work_order_material_id_fkey"
            columns: ["work_order_material_id"]
            isOneToOne: false
            referencedRelation: "work_order_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      production_kits: {
        Row: {
          created_at: string
          id: string
          issued_at: string | null
          issued_by: string | null
          kit_number: string
          notes: string | null
          prepared_at: string | null
          prepared_by: string | null
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kit_number: string
          notes?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kit_number?: string
          notes?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_kits_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_ncrs: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          disposition_notes: string | null
          dispositioned_at: string | null
          dispositioned_by: string | null
          id: string
          ncr_number: string
          production_unit_id: string | null
          raised_at: string
          raised_by: string
          route_step_id: string | null
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description: string
          disposition_notes?: string | null
          dispositioned_at?: string | null
          dispositioned_by?: string | null
          id?: string
          ncr_number: string
          production_unit_id?: string | null
          raised_at?: string
          raised_by?: string
          route_step_id?: string | null
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string
          disposition_notes?: string | null
          dispositioned_at?: string | null
          dispositioned_by?: string | null
          id?: string
          ncr_number?: string
          production_unit_id?: string | null
          raised_at?: string
          raised_by?: string
          route_step_id?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_ncrs_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_ncrs_route_step_id_fkey"
            columns: ["route_step_id"]
            isOneToOne: false
            referencedRelation: "production_route_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_ncrs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_ppap_packages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          evidence_notes: string | null
          id: string
          package_number: string
          revision: string
          status: string
          submitted_at: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          evidence_notes?: string | null
          id?: string
          package_number: string
          revision?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          evidence_notes?: string | null
          id?: string
          package_number?: string
          revision?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_ppap_packages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_ppap_packages_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_route_steps: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          requires_quality_hold: boolean
          route_id: string
          station_type: string
          step_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          requires_quality_hold?: boolean
          route_id: string
          station_type?: string
          step_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          requires_quality_hold?: boolean
          route_id?: string
          station_type?: string
          step_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_route_steps_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "production_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_routes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          revision: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          revision?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          revision?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_step_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          performed_by: string
          production_unit_id: string
          route_step_id: string | null
          started_at: string
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string
          production_unit_id: string
          route_step_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string
          production_unit_id?: string
          route_step_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_step_executions_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_step_executions_route_step_id_fkey"
            columns: ["route_step_id"]
            isOneToOne: false
            referencedRelation: "production_route_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_step_executions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_unit_tests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          measured_data: Json
          notes: string | null
          production_unit_id: string
          result: string
          test_type: string
          tested_at: string
          tested_by: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          measured_data?: Json
          notes?: string | null
          production_unit_id: string
          result: string
          test_type: string
          tested_at?: string
          tested_by?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          measured_data?: Json
          notes?: string | null
          production_unit_id?: string
          result?: string
          test_type?: string
          tested_at?: string
          tested_by?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_unit_tests_production_unit_id_fkey"
            columns: ["production_unit_id"]
            isOneToOne: false
            referencedRelation: "production_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_unit_tests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_units: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          firmware_reference: string | null
          id: string
          serial_number: string
          unit_status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          firmware_reference?: string | null
          id?: string
          serial_number: string
          unit_status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          firmware_reference?: string | null
          id?: string
          serial_number?: string
          unit_status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_units_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "production_route_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_units_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department_type"] | null
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      project_bom_items: {
        Row: {
          bom_id: string
          created_at: string
          description: string | null
          footprint: string | null
          id: string
          line_index: number
          manufacturer: string | null
          match_status: string | null
          matched_component_id: string | null
          mpn: string | null
          quantity: number
          refs: string | null
          remark: string | null
          shortage: number
          total_cost: number | null
          unit_cost: number | null
          value: string | null
        }
        Insert: {
          bom_id: string
          created_at?: string
          description?: string | null
          footprint?: string | null
          id?: string
          line_index: number
          manufacturer?: string | null
          match_status?: string | null
          matched_component_id?: string | null
          mpn?: string | null
          quantity: number
          refs?: string | null
          remark?: string | null
          shortage?: number
          total_cost?: number | null
          unit_cost?: number | null
          value?: string | null
        }
        Update: {
          bom_id?: string
          created_at?: string
          description?: string | null
          footprint?: string | null
          id?: string
          line_index?: number
          manufacturer?: string | null
          match_status?: string | null
          matched_component_id?: string | null
          mpn?: string | null
          quantity?: number
          refs?: string | null
          remark?: string | null
          shortage?: number
          total_cost?: number | null
          unit_cost?: number | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "project_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bom_items_matched_component_id_fkey"
            columns: ["matched_component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      project_boms: {
        Row: {
          bom_number: string
          created_at: string
          created_by: string | null
          id: string
          line_count: number
          name: string
          notes: string | null
          project_id: string
          revision: string | null
          source_filename: string | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          bom_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          line_count?: number
          name: string
          notes?: string | null
          project_id: string
          revision?: string | null
          source_filename?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          bom_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          line_count?: number
          name?: string
          notes?: string | null
          project_id?: string
          revision?: string | null
          source_filename?: string | null
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_boms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_change_requests: {
        Row: {
          approved_at: string | null
          approved_by_employee_id: string | null
          change_code: string
          change_type: string
          created_at: string
          description: string | null
          id: string
          impact_summary: string | null
          implemented_at: string | null
          project_id: string
          requested_by_employee_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_employee_id?: string | null
          change_code: string
          change_type?: string
          created_at?: string
          description?: string | null
          id?: string
          impact_summary?: string | null
          implemented_at?: string | null
          project_id: string
          requested_by_employee_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_employee_id?: string | null
          change_code?: string
          change_type?: string
          created_at?: string
          description?: string | null
          id?: string
          impact_summary?: string | null
          implemented_at?: string | null
          project_id?: string
          requested_by_employee_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_change_requests_approved_by_employee_id_fkey"
            columns: ["approved_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_change_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_design_inputs: {
        Row: {
          acceptance_criteria: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          input_code: string
          owner_employee_id: string | null
          priority: string
          project_id: string
          source_requirement_id: string | null
          source_revision_id: string | null
          status: string
          title: string
          updated_at: string
          verification_method: string | null
        }
        Insert: {
          acceptance_criteria?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          input_code: string
          owner_employee_id?: string | null
          priority?: string
          project_id: string
          source_requirement_id?: string | null
          source_revision_id?: string | null
          status?: string
          title: string
          updated_at?: string
          verification_method?: string | null
        }
        Update: {
          acceptance_criteria?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          input_code?: string
          owner_employee_id?: string | null
          priority?: string
          project_id?: string
          source_requirement_id?: string | null
          source_revision_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_design_inputs_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_inputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_inputs_source_requirement_id_fkey"
            columns: ["source_requirement_id"]
            isOneToOne: false
            referencedRelation: "customer_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_design_inputs_source_revision_id_fkey"
            columns: ["source_revision_id"]
            isOneToOne: false
            referencedRelation: "customer_requirement_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_engineering_registers: {
        Row: {
          created_at: string
          drive_node_id: string | null
          id: string
          metadata: Json
          owner_employee_id: string | null
          project_id: string
          reference_code: string
          register_type: string
          revision: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          drive_node_id?: string | null
          id?: string
          metadata?: Json
          owner_employee_id?: string | null
          project_id: string
          reference_code: string
          register_type: string
          revision?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          drive_node_id?: string | null
          id?: string
          metadata?: Json
          owner_employee_id?: string | null
          project_id?: string
          reference_code?: string
          register_type?: string
          revision?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_engineering_registers_drive_node_id_fkey"
            columns: ["drive_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_engineering_registers_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_engineering_registers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_issues: {
        Row: {
          closed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          issue_code: string
          issue_type: string
          owner_employee_id: string | null
          project_id: string
          resolution: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issue_code: string
          issue_type?: string
          owner_employee_id?: string | null
          project_id: string
          resolution?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issue_code?: string
          issue_type?: string
          owner_employee_id?: string | null
          project_id?: string
          resolution?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_issues_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_research_records: {
        Row: {
          component_id: string | null
          conclusion: string | null
          created_at: string
          decision_status: string
          drive_node_id: string | null
          id: string
          owner_employee_id: string | null
          project_id: string
          recommendation: string | null
          research_type: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          component_id?: string | null
          conclusion?: string | null
          created_at?: string
          decision_status?: string
          drive_node_id?: string | null
          id?: string
          owner_employee_id?: string | null
          project_id: string
          recommendation?: string | null
          research_type?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          component_id?: string | null
          conclusion?: string | null
          created_at?: string
          decision_status?: string
          drive_node_id?: string | null
          id?: string
          owner_employee_id?: string | null
          project_id?: string
          recommendation?: string | null
          research_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_research_records_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_research_records_drive_node_id_fkey"
            columns: ["drive_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_research_records_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_research_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stage_gates: {
        Row: {
          completed_at: string | null
          created_at: string
          evidence_note: string | null
          gate_code: string
          gate_type: string
          id: string
          owner_employee_id: string | null
          project_id: string
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          evidence_note?: string | null
          gate_code: string
          gate_type?: string
          id?: string
          owner_employee_id?: string | null
          project_id: string
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          evidence_note?: string | null
          gate_code?: string
          gate_type?: string
          id?: string
          owner_employee_id?: string | null
          project_id?: string
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stage_gates_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stage_gates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_activity: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          id: string
          kind: string
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"] | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          kind?: string
          task_id: string
          to_status?: Database["public"]["Enums"]["task_status"] | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          kind?: string
          task_id?: string
          to_status?: Database["public"]["Enums"]["task_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_checklists: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          label: string
          sort_order: number
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          label: string
          sort_order?: number
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          label?: string
          sort_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department_type"]
          department_id: string | null
          description: string | null
          drive_node_id: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          logged_hours: number
          pcb_task_id: string | null
          ppap_element: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"]
          department_id?: string | null
          description?: string | null
          drive_node_id?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          logged_hours?: number
          pcb_task_id?: string | null
          ppap_element?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department_type"]
          department_id?: string | null
          description?: string | null
          drive_node_id?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          logged_hours?: number
          pcb_task_id?: string | null
          ppap_element?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "rd_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_drive_node_id_fkey"
            columns: ["drive_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_pcb_task_id_fkey"
            columns: ["pcb_task_id"]
            isOneToOne: false
            referencedRelation: "pcb_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          access_level: string
          added_by: string | null
          created_at: string
          discipline: string | null
          employee_id: string
          id: string
          is_lead: boolean
          project_id: string
          project_role: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          added_by?: string | null
          created_at?: string
          discipline?: string | null
          employee_id: string
          id?: string
          is_lead?: boolean
          project_id: string
          project_role: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          added_by?: string | null
          created_at?: string
          discipline?: string | null
          employee_id?: string
          id?: string
          is_lead?: boolean
          project_id?: string
          project_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          annual_volume: number | null
          archived_at: string | null
          code: string
          color: string
          completion_notes: string | null
          created_at: string
          customer_id: string | null
          design_link: string | null
          engineering_lead_employee_id: string | null
          health_status: string
          id: string
          name: string
          opportunity_id: string | null
          planned_start_date: string | null
          priority: string
          project_drive_node_id: string | null
          project_manager_employee_id: string | null
          project_stage: string
          project_type: string
          prototype_quantity: number | null
          requirement_baseline_id: string | null
          revision: string | null
          status: string
          target_sop_date: string | null
          updated_at: string
        }
        Insert: {
          annual_volume?: number | null
          archived_at?: string | null
          code: string
          color?: string
          completion_notes?: string | null
          created_at?: string
          customer_id?: string | null
          design_link?: string | null
          engineering_lead_employee_id?: string | null
          health_status?: string
          id?: string
          name: string
          opportunity_id?: string | null
          planned_start_date?: string | null
          priority?: string
          project_drive_node_id?: string | null
          project_manager_employee_id?: string | null
          project_stage?: string
          project_type?: string
          prototype_quantity?: number | null
          requirement_baseline_id?: string | null
          revision?: string | null
          status?: string
          target_sop_date?: string | null
          updated_at?: string
        }
        Update: {
          annual_volume?: number | null
          archived_at?: string | null
          code?: string
          color?: string
          completion_notes?: string | null
          created_at?: string
          customer_id?: string | null
          design_link?: string | null
          engineering_lead_employee_id?: string | null
          health_status?: string
          id?: string
          name?: string
          opportunity_id?: string | null
          planned_start_date?: string | null
          priority?: string
          project_drive_node_id?: string | null
          project_manager_employee_id?: string | null
          project_stage?: string
          project_type?: string
          prototype_quantity?: number | null
          requirement_baseline_id?: string | null
          revision?: string | null
          status?: string
          target_sop_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_engineering_lead_employee_id_fkey"
            columns: ["engineering_lead_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_drive_node_id_fkey"
            columns: ["project_drive_node_id"]
            isOneToOne: false
            referencedRelation: "drive_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_employee_id_fkey"
            columns: ["project_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_requirement_baseline_id_fkey"
            columns: ["requirement_baseline_id"]
            isOneToOne: false
            referencedRelation: "requirement_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          component_id: string | null
          created_at: string
          description: string | null
          id: string
          mpn: string
          po_id: string
          quantity_ordered: number
          quantity_received: number
          quantity_rejected: number
          short_close_reason: string | null
          short_closed: boolean
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mpn: string
          po_id: string
          quantity_ordered: number
          quantity_received?: number
          quantity_rejected?: number
          short_close_reason?: string | null
          short_closed?: boolean
          total_cost?: number | null
          unit_cost?: number
        }
        Update: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mpn?: string
          po_id?: string
          quantity_ordered?: number
          quantity_received?: number
          quantity_rejected?: number
          short_close_reason?: string | null
          short_closed?: boolean
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          buyer_approval_status: string
          created_at: string
          created_by: string | null
          currency: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          original_delivery_date: string | null
          po_number: string
          project_id: string | null
          sent_at: string | null
          sent_by: string | null
          sent_to: string | null
          source_request_id: string | null
          status: string
          tax_amount: number
          total_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          buyer_approval_status?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          original_delivery_date?: string | null
          po_number: string
          project_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string | null
          source_request_id?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          buyer_approval_status?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          original_delivery_date?: string | null
          po_number?: string
          project_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string | null
          source_request_id?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          component_id: string | null
          created_at: string
          description: string | null
          id: string
          mpn: string | null
          notes: string | null
          purchase_request_id: string
          required_quantity: number
          shortage_quantity: number | null
          target_unit_cost: number | null
          unit: string
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mpn?: string | null
          notes?: string | null
          purchase_request_id: string
          required_quantity: number
          shortage_quantity?: number | null
          target_unit_cost?: number | null
          unit?: string
        }
        Update: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mpn?: string | null
          notes?: string | null
          purchase_request_id?: string
          required_quantity?: number
          shortage_quantity?: number | null
          target_unit_cost?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bom_id: string | null
          created_at: string
          delay_impact: string | null
          department_id: string | null
          id: string
          is_capex: boolean
          notes: string | null
          project_id: string | null
          request_number: string
          requester_id: string
          required_date: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_entity_id: string | null
          source_type: string
          status: string
          submitted_at: string | null
          updated_at: string
          urgency: string
          urgency_reason: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bom_id?: string | null
          created_at?: string
          delay_impact?: string | null
          department_id?: string | null
          id?: string
          is_capex?: boolean
          notes?: string | null
          project_id?: string | null
          request_number: string
          requester_id?: string
          required_date?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entity_id?: string | null
          source_type?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          urgency?: string
          urgency_reason?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bom_id?: string | null
          created_at?: string
          delay_impact?: string | null
          department_id?: string | null
          id?: string
          is_capex?: boolean
          notes?: string | null
          project_id?: string | null
          request_number?: string
          requester_id?: string
          required_date?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entity_id?: string | null
          source_type?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          urgency?: string
          urgency_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "project_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_audit_findings: {
        Row: {
          audit_id: string
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          evidence_reference: string | null
          finding_code: string
          finding_type: string
          id: string
          owner_user_id: string | null
          requirement_reference: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          created_by?: string
          description: string
          due_date?: string | null
          evidence_reference?: string | null
          finding_code: string
          finding_type?: string
          id?: string
          owner_user_id?: string | null
          requirement_reference?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          evidence_reference?: string | null
          finding_code?: string
          finding_type?: string
          id?: string
          owner_user_id?: string | null
          requirement_reference?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "qms_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_audits: {
        Row: {
          audit_code: string
          audit_type: string
          auditee_user_id: string | null
          auditor_user_id: string | null
          checklist_reference: string | null
          created_at: string
          created_by: string
          criteria: string | null
          department_id: string | null
          id: string
          planned_date: string | null
          process_name: string | null
          risk_basis: string | null
          scope: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          audit_code: string
          audit_type: string
          auditee_user_id?: string | null
          auditor_user_id?: string | null
          checklist_reference?: string | null
          created_at?: string
          created_by?: string
          criteria?: string | null
          department_id?: string | null
          id?: string
          planned_date?: string | null
          process_name?: string | null
          risk_basis?: string | null
          scope?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          audit_code?: string
          audit_type?: string
          auditee_user_id?: string | null
          auditor_user_id?: string | null
          checklist_reference?: string | null
          created_at?: string
          created_by?: string
          criteria?: string | null
          department_id?: string | null
          id?: string
          planned_date?: string | null
          process_name?: string | null
          risk_basis?: string | null
          scope?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_audits_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_capas: {
        Row: {
          capa_code: string
          closed_at: string | null
          closed_by: string | null
          containment_action: string | null
          correction_action: string | null
          corrective_action: string | null
          created_at: string
          created_by: string
          effectiveness_due_date: string | null
          effectiveness_review: string | null
          effectiveness_reviewer_id: string | null
          id: string
          owner_user_id: string | null
          problem_statement: string
          root_cause_method: string | null
          root_cause_summary: string | null
          source_record_id: string | null
          source_type: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          capa_code: string
          closed_at?: string | null
          closed_by?: string | null
          containment_action?: string | null
          correction_action?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          effectiveness_due_date?: string | null
          effectiveness_review?: string | null
          effectiveness_reviewer_id?: string | null
          id?: string
          owner_user_id?: string | null
          problem_statement: string
          root_cause_method?: string | null
          root_cause_summary?: string | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          capa_code?: string
          closed_at?: string | null
          closed_by?: string | null
          containment_action?: string | null
          correction_action?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          effectiveness_due_date?: string | null
          effectiveness_review?: string | null
          effectiveness_reviewer_id?: string | null
          id?: string
          owner_user_id?: string | null
          problem_statement?: string
          root_cause_method?: string | null
          root_cause_summary?: string | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      qms_contingency_plans: {
        Row: {
          affected_process: string | null
          backup_resource: string | null
          communication_plan: string | null
          created_at: string
          created_by: string
          customer_impact: string | null
          id: string
          last_review_date: string | null
          last_test_date: string | null
          next_review_date: string | null
          plan_code: string
          recovery_steps: string | null
          recovery_validation: string | null
          response_plan: string
          responsible_roles: string | null
          risk_id: string | null
          scenario: string
          status: string
          updated_at: string
        }
        Insert: {
          affected_process?: string | null
          backup_resource?: string | null
          communication_plan?: string | null
          created_at?: string
          created_by?: string
          customer_impact?: string | null
          id?: string
          last_review_date?: string | null
          last_test_date?: string | null
          next_review_date?: string | null
          plan_code: string
          recovery_steps?: string | null
          recovery_validation?: string | null
          response_plan: string
          responsible_roles?: string | null
          risk_id?: string | null
          scenario: string
          status?: string
          updated_at?: string
        }
        Update: {
          affected_process?: string | null
          backup_resource?: string | null
          communication_plan?: string | null
          created_at?: string
          created_by?: string
          customer_impact?: string | null
          id?: string
          last_review_date?: string | null
          last_test_date?: string | null
          next_review_date?: string | null
          plan_code?: string
          recovery_steps?: string | null
          recovery_validation?: string | null
          response_plan?: string
          responsible_roles?: string | null
          risk_id?: string | null
          scenario?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_contingency_plans_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "qms_risks"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_contingency_tests: {
        Row: {
          action_summary: string | null
          created_at: string
          created_by: string
          effectiveness: string | null
          evidence_reference: string | null
          gap_summary: string | null
          id: string
          observed_result: string | null
          participants: string | null
          plan_id: string
          test_date: string
        }
        Insert: {
          action_summary?: string | null
          created_at?: string
          created_by?: string
          effectiveness?: string | null
          evidence_reference?: string | null
          gap_summary?: string | null
          id?: string
          observed_result?: string | null
          participants?: string | null
          plan_id: string
          test_date: string
        }
        Update: {
          action_summary?: string | null
          created_at?: string
          created_by?: string
          effectiveness?: string | null
          evidence_reference?: string | null
          gap_summary?: string | null
          id?: string
          observed_result?: string | null
          participants?: string | null
          plan_id?: string
          test_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_contingency_tests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "qms_contingency_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_improvements: {
        Row: {
          benefit_summary: string | null
          created_at: string
          created_by: string
          description: string | null
          evidence_reference: string | null
          id: string
          improvement_code: string
          owner_user_id: string | null
          source_record_id: string | null
          source_type: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          benefit_summary?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          evidence_reference?: string | null
          id?: string
          improvement_code: string
          owner_user_id?: string | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          benefit_summary?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          evidence_reference?: string | null
          id?: string
          improvement_code?: string
          owner_user_id?: string | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      qms_kpi_formula_versions: {
        Row: {
          calculation_method: string
          change_reason: string | null
          changed_by: string
          created_at: string
          effective_date: string
          id: string
          kpi_id: string
          source_reference: string | null
          version_number: number
        }
        Insert: {
          calculation_method: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          effective_date?: string
          id?: string
          kpi_id: string
          source_reference?: string | null
          version_number: number
        }
        Update: {
          calculation_method?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          effective_date?: string
          id?: string
          kpi_id?: string
          source_reference?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "qms_kpi_formula_versions_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "qms_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_kpi_snapshots: {
        Row: {
          created_at: string
          data_quality_reason: string | null
          data_quality_status: string
          entered_by: string | null
          evidence_reference: string | null
          formula_version_id: string | null
          id: string
          kpi_id: string
          period_end: string
          period_start: string
          reviewed_by: string | null
          source_data_timestamp: string | null
          status: string
          target_value: number | null
          value: number | null
        }
        Insert: {
          created_at?: string
          data_quality_reason?: string | null
          data_quality_status?: string
          entered_by?: string | null
          evidence_reference?: string | null
          formula_version_id?: string | null
          id?: string
          kpi_id: string
          period_end: string
          period_start: string
          reviewed_by?: string | null
          source_data_timestamp?: string | null
          status?: string
          target_value?: number | null
          value?: number | null
        }
        Update: {
          created_at?: string
          data_quality_reason?: string | null
          data_quality_status?: string
          entered_by?: string | null
          evidence_reference?: string | null
          formula_version_id?: string | null
          id?: string
          kpi_id?: string
          period_end?: string
          period_start?: string
          reviewed_by?: string | null
          source_data_timestamp?: string | null
          status?: string
          target_value?: number | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qms_kpi_snapshots_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "qms_kpi_formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qms_kpi_snapshots_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "qms_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_kpis: {
        Row: {
          calculation_method: string | null
          created_at: string
          created_by: string
          critical_threshold: number | null
          department_id: string | null
          description: string | null
          direction: string
          frequency: string
          id: string
          is_active: boolean
          kpi_code: string
          name: string
          owner_user_id: string | null
          reviewer_user_id: string | null
          source_reference: string | null
          source_type: string
          target_value: number | null
          unit: string | null
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          calculation_method?: string | null
          created_at?: string
          created_by?: string
          critical_threshold?: number | null
          department_id?: string | null
          description?: string | null
          direction?: string
          frequency?: string
          id?: string
          is_active?: boolean
          kpi_code: string
          name: string
          owner_user_id?: string | null
          reviewer_user_id?: string | null
          source_reference?: string | null
          source_type?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          calculation_method?: string | null
          created_at?: string
          created_by?: string
          critical_threshold?: number | null
          department_id?: string | null
          description?: string | null
          direction?: string
          frequency?: string
          id?: string
          is_active?: boolean
          kpi_code?: string
          name?: string
          owner_user_id?: string | null
          reviewer_user_id?: string | null
          source_reference?: string | null
          source_type?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qms_kpis_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_lessons_learned: {
        Row: {
          applicability: string | null
          context: string | null
          created_at: string
          created_by: string
          id: string
          lesson: string
          lesson_code: string
          recommendation: string | null
          source_record_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          applicability?: string | null
          context?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lesson: string
          lesson_code: string
          recommendation?: string | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          applicability?: string | null
          context?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lesson?: string
          lesson_code?: string
          recommendation?: string | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      qms_management_reviews: {
        Row: {
          action_summary: string | null
          created_at: string
          created_by: string
          decisions: string | null
          id: string
          meeting_date: string | null
          next_review_date: string | null
          performance_summary: string | null
          planned_date: string
          review_code: string
          scope: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_summary?: string | null
          created_at?: string
          created_by?: string
          decisions?: string | null
          id?: string
          meeting_date?: string | null
          next_review_date?: string | null
          performance_summary?: string | null
          planned_date: string
          review_code: string
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_summary?: string | null
          created_at?: string
          created_by?: string
          decisions?: string | null
          id?: string
          meeting_date?: string | null
          next_review_date?: string | null
          performance_summary?: string | null
          planned_date?: string
          review_code?: string
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qms_objective_kpis: {
        Row: {
          created_at: string
          kpi_id: string
          objective_id: string
        }
        Insert: {
          created_at?: string
          kpi_id: string
          objective_id: string
        }
        Update: {
          created_at?: string
          kpi_id?: string
          objective_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_objective_kpis_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "qms_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qms_objective_kpis_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "qms_quality_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_quality_objectives: {
        Row: {
          action_plan: string | null
          baseline_value: number | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          end_date: string | null
          evidence_reference: string | null
          frequency: string
          id: string
          metric_summary: string | null
          objective_code: string
          owner_user_id: string | null
          review_notes: string | null
          start_date: string | null
          status: string
          target_value: number | null
          title: string
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          baseline_value?: number | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          evidence_reference?: string | null
          frequency?: string
          id?: string
          metric_summary?: string | null
          objective_code: string
          owner_user_id?: string | null
          review_notes?: string | null
          start_date?: string | null
          status?: string
          target_value?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          baseline_value?: number | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          evidence_reference?: string | null
          frequency?: string
          id?: string
          metric_summary?: string | null
          objective_code?: string
          owner_user_id?: string | null
          review_notes?: string | null
          start_date?: string | null
          status?: string
          target_value?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_quality_objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_retention_policies: {
        Row: {
          archive_method: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          legal_customer_basis: string | null
          owner_user_id: string | null
          record_type: string
          retention_duration_months: number
          retention_trigger: string
          updated_at: string
        }
        Insert: {
          archive_method?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          legal_customer_basis?: string | null
          owner_user_id?: string | null
          record_type: string
          retention_duration_months: number
          retention_trigger: string
          updated_at?: string
        }
        Update: {
          archive_method?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          legal_customer_basis?: string | null
          owner_user_id?: string | null
          record_type?: string
          retention_duration_months?: number
          retention_trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
      qms_risks: {
        Row: {
          action_plan: string | null
          cause: string | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string
          due_date: string | null
          existing_controls: string | null
          id: string
          likelihood: number | null
          owner_user_id: string | null
          potential_impact: string | null
          process_name: string | null
          record_kind: string
          residual_risk: number | null
          risk_code: string
          risk_evaluation: number | null
          severity: number | null
          source_record_id: string | null
          source_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          cause?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description: string
          due_date?: string | null
          existing_controls?: string | null
          id?: string
          likelihood?: number | null
          owner_user_id?: string | null
          potential_impact?: string | null
          process_name?: string | null
          record_kind?: string
          residual_risk?: number | null
          risk_code: string
          risk_evaluation?: number | null
          severity?: number | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          cause?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string
          due_date?: string | null
          existing_controls?: string | null
          id?: string
          likelihood?: number | null
          owner_user_id?: string | null
          potential_impact?: string | null
          process_name?: string | null
          record_kind?: string
          residual_risk?: number | null
          risk_code?: string
          risk_evaluation?: number | null
          severity?: number | null
          source_record_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_risks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          department_id: string | null
          description: string
          expense_number: string
          finance_notes: string | null
          finance_reviewed_at: string | null
          finance_reviewed_by: string | null
          id: string
          is_rd: boolean
          project_id: string | null
          receipt_path: string | null
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency?: string
          department_id?: string | null
          description: string
          expense_number: string
          finance_notes?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          id?: string
          is_rd?: boolean
          project_id?: string | null
          receipt_path?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          department_id?: string | null
          description?: string
          expense_number?: string
          finance_notes?: string | null
          finance_reviewed_at?: string | null
          finance_reviewed_by?: string | null
          id?: string
          is_rd?: boolean
          project_id?: string | null
          receipt_path?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          component_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_time_days: number | null
          moq: number | null
          mpn: string | null
          notes: string | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_time_days?: number | null
          moq?: number | null
          mpn?: string | null
          notes?: string | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Update: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_time_days?: number | null
          moq?: number | null
          mpn?: string | null
          notes?: string | null
          quantity?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          extraction: Json | null
          extraction_confirmed_at: string | null
          extraction_confirmed_by: string | null
          id: string
          lead_time_days: number | null
          payment_terms: string | null
          quotation_number: string
          quoted_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rfq_id: string | null
          source_file_path: string | null
          status: string
          updated_at: string
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          currency?: string
          extraction?: Json | null
          extraction_confirmed_at?: string | null
          extraction_confirmed_by?: string | null
          id?: string
          lead_time_days?: number | null
          payment_terms?: string | null
          quotation_number: string
          quoted_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rfq_id?: string | null
          source_file_path?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          extraction?: Json | null
          extraction_confirmed_at?: string | null
          extraction_confirmed_by?: string | null
          id?: string
          lead_time_days?: number | null
          payment_terms?: string | null
          quotation_number?: string
          quoted_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rfq_id?: string | null
          source_file_path?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_members: {
        Row: {
          active: boolean
          created_at: string
          department: Database["public"]["Enums"]["department_type"] | null
          department_id: string | null
          email: string
          id: string
          name: string
          role: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          department_id?: string | null
          email: string
          id?: string
          name: string
          role?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          department_id?: string | null
          email?: string
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rd_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_baselines: {
        Row: {
          approved_at: string
          approved_by: string | null
          baseline_number: string | null
          commercial_snapshot: Json
          created_at: string
          id: string
          requirement_id: string
          requirement_snapshot: Json
          revision_number: number
          status: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          baseline_number?: string | null
          commercial_snapshot?: Json
          created_at?: string
          id?: string
          requirement_id: string
          requirement_snapshot: Json
          revision_number: number
          status?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          baseline_number?: string | null
          commercial_snapshot?: Json
          created_at?: string
          id?: string
          requirement_id?: string
          requirement_snapshot?: Json
          revision_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_baselines_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "customer_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_change_requests: {
        Row: {
          baseline_id: string
          change_number: string
          created_at: string
          created_by: string | null
          id: string
          impact_summary: string | null
          requested_by: string | null
          requirement_id: string
          resolution_notes: string | null
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          baseline_id: string
          change_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          impact_summary?: string | null
          requested_by?: string | null
          requirement_id: string
          resolution_notes?: string | null
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          baseline_id?: string
          change_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          impact_summary?: string | null
          requested_by?: string | null
          requirement_id?: string
          resolution_notes?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_change_requests_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "requirement_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_change_requests_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "customer_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_feasibility_reviews: {
        Row: {
          assumptions: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          findings: string | null
          id: string
          requirement_id: string
          reviewed_at: string | null
          reviewer_user_id: string | null
          risks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assumptions?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          findings?: string | null
          id?: string
          requirement_id: string
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          risks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assumptions?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          findings?: string | null
          id?: string
          requirement_id?: string
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          risks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_feasibility_reviews_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_feasibility_reviews_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "customer_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_vendors: {
        Row: {
          acknowledged_at: string | null
          id: string
          rfq_id: string
          sent_at: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          id?: string
          rfq_id: string
          sent_at?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          acknowledged_at?: string | null
          id?: string
          rfq_id?: string
          sent_at?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_vendors_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string | null
          purchase_request_id: string | null
          response_due_date: string | null
          rfq_number: string
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string | null
          purchase_request_id?: string | null
          response_due_date?: string | null
          rfq_number: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string | null
          purchase_request_id?: string | null
          response_due_date?: string | null
          rfq_number?: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rtv_records: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          awb_number: string | null
          closed_at: string | null
          closed_by: string | null
          courier: string | null
          created_at: string
          dispatched_at: string | null
          grn_id: string | null
          id: string
          ncr_id: string | null
          reason: string | null
          rtv_number: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          awb_number?: string | null
          closed_at?: string | null
          closed_by?: string | null
          courier?: string | null
          created_at?: string
          dispatched_at?: string | null
          grn_id?: string | null
          id?: string
          ncr_id?: string | null
          reason?: string | null
          rtv_number: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          awb_number?: string | null
          closed_at?: string | null
          closed_by?: string | null
          courier?: string | null
          created_at?: string
          dispatched_at?: string | null
          grn_id?: string | null
          id?: string
          ncr_id?: string | null
          reason?: string | null
          rtv_number?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rtv_records_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rtv_records_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "supplier_ncrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rtv_records_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_commercial_records: {
        Row: {
          authorization_reference: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_authorized_at: string | null
          id: string
          notes: string | null
          quotation_reference: string | null
          quoted_amount: number | null
          requirement_id: string
          status: string
          updated_at: string
        }
        Insert: {
          authorization_reference?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_authorized_at?: string | null
          id?: string
          notes?: string | null
          quotation_reference?: string | null
          quoted_amount?: number | null
          requirement_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          authorization_reference?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_authorized_at?: string | null
          id?: string
          notes?: string | null
          quotation_reference?: string | null
          quoted_amount?: number | null
          requirement_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_commercial_records_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: true
            referencedRelation: "customer_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_enquiries: {
        Row: {
          application: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          enquiry_date: string
          enquiry_number: string | null
          estimated_volume: string | null
          expected_timeline: string | null
          id: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          priority: string
          product_type: string | null
          requirement_summary: string
          sales_owner_user_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          application?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          enquiry_date?: string
          enquiry_number?: string | null
          estimated_volume?: string | null
          expected_timeline?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          priority?: string
          product_type?: string | null
          requirement_summary: string
          sales_owner_user_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          application?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          enquiry_date?: string
          enquiry_number?: string | null
          estimated_volume?: string | null
          expected_timeline?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          priority?: string
          product_type?: string | null
          requirement_summary?: string
          sales_owner_user_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_enquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_enquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_nda_records: {
        Row: {
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          opportunity_id: string
          secure_token: string
          signed_at: string | null
          signed_by_email: string | null
          signed_by_name: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          secure_token?: string
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          secure_token?: string
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_nda_records_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_nda_records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sales_nda_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_nda_templates: {
        Row: {
          content_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          version: string
        }
        Insert: {
          content_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          version?: string
        }
        Update: {
          content_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      sales_opportunities: {
        Row: {
          application: string | null
          backup_sales_owner_user_id: string | null
          business_development_owner_user_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          enquiry_id: string | null
          estimated_volume: string | null
          id: string
          name: string
          nda_required: boolean
          next_action: string | null
          next_action_date: string | null
          next_action_owner_user_id: string | null
          notes: string | null
          opportunity_number: string | null
          primary_contact_id: string | null
          primary_sales_owner_user_id: string | null
          priority: string
          product_type: string | null
          stage: string
          status: string
          target_timeline: string | null
          updated_at: string
        }
        Insert: {
          application?: string | null
          backup_sales_owner_user_id?: string | null
          business_development_owner_user_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          enquiry_id?: string | null
          estimated_volume?: string | null
          id?: string
          name: string
          nda_required?: boolean
          next_action?: string | null
          next_action_date?: string | null
          next_action_owner_user_id?: string | null
          notes?: string | null
          opportunity_number?: string | null
          primary_contact_id?: string | null
          primary_sales_owner_user_id?: string | null
          priority?: string
          product_type?: string | null
          stage?: string
          status?: string
          target_timeline?: string | null
          updated_at?: string
        }
        Update: {
          application?: string | null
          backup_sales_owner_user_id?: string | null
          business_development_owner_user_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          enquiry_id?: string | null
          estimated_volume?: string | null
          id?: string
          name?: string
          nda_required?: boolean
          next_action?: string | null
          next_action_date?: string | null
          next_action_owner_user_id?: string | null
          notes?: string | null
          opportunity_number?: string | null
          primary_contact_id?: string | null
          primary_sales_owner_user_id?: string | null
          priority?: string
          product_type?: string | null
          stage?: string
          status?: string
          target_timeline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "sales_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_project_handovers: {
        Row: {
          baseline_id: string
          created_at: string
          handover_notes: string | null
          id: string
          initiated_at: string | null
          initiated_by: string | null
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          baseline_id: string
          created_at?: string
          handover_notes?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          baseline_id?: string
          created_at?: string
          handover_notes?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_project_handovers_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: true
            referencedRelation: "requirement_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_handovers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          details: string | null
          facility_location_id: string | null
          id: string
          incident_code: string
          occurred_at: string
          reported_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          details?: string | null
          facility_location_id?: string | null
          id?: string
          incident_code: string
          occurred_at?: string
          reported_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          details?: string | null
          facility_location_id?: string | null
          id?: string
          incident_code?: string
          occurred_at?: string
          reported_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_incidents_facility_location_id_fkey"
            columns: ["facility_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_boms: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          payload: Json
          revoked_at: string | null
          title: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          payload: Json
          revoked_at?: string | null
          title?: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json
          revoked_at?: string | null
          title?: string
          token?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          adjusted_at: string
          adjusted_by: string
          adjustment_number: string
          component_id: string
          delta: number
          id: string
          location_id: string
          reason: string
          request_key: string
        }
        Insert: {
          adjusted_at?: string
          adjusted_by: string
          adjustment_number: string
          component_id: string
          delta: number
          id?: string
          location_id: string
          reason: string
          request_key: string
        }
        Update: {
          adjusted_at?: string
          adjusted_by?: string
          adjustment_number?: string
          component_id?: string
          delta?: number
          id?: string
          location_id?: string
          reason?: string
          request_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_request_key_fkey"
            columns: ["request_key"]
            isOneToOne: true
            referencedRelation: "inventory_transaction_requests"
            referencedColumns: ["request_key"]
          },
        ]
      }
      stock_history: {
        Row: {
          action: string
          component_id: string
          created_at: string
          delta: number
          id: string
          location_id: string | null
          note: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          component_id: string
          created_at?: string
          delta: number
          id?: string
          location_id?: string | null
          note?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          component_id?: string
          created_at?: string
          delta?: number
          id?: string
          location_id?: string | null
          note?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_history_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          component_id: string
          from_location_id: string
          id: string
          notes: string | null
          quantity: number
          request_key: string
          to_location_id: string
          transfer_number: string
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          component_id: string
          from_location_id: string
          id?: string
          notes?: string | null
          quantity: number
          request_key: string
          to_location_id: string
          transfer_number: string
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          component_id?: string
          from_location_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          request_key?: string
          to_location_id?: string
          transfer_number?: string
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_request_key_fkey"
            columns: ["request_key"]
            isOneToOne: true
            referencedRelation: "inventory_transaction_requests"
            referencedColumns: ["request_key"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_ncrs: {
        Row: {
          corrective_action: string | null
          created_at: string
          created_by: string
          grn_id: string | null
          id: string
          inspection_id: string | null
          issue_summary: string
          ncr_number: string
          response_due_date: string | null
          root_cause: string | null
          status: string
          updated_at: string
          vendor_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          grn_id?: string | null
          id?: string
          inspection_id?: string | null
          issue_summary: string
          ncr_number: string
          response_due_date?: string | null
          root_cause?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          grn_id?: string | null
          id?: string
          inspection_id?: string | null
          issue_summary?: string
          ncr_number?: string
          response_due_date?: string | null
          root_cause?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_ncrs_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ncrs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "incoming_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ncrs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_entries: {
        Row: {
          created_at: string
          created_by: string | null
          driver_name: string | null
          driver_phone: string | null
          entered_at: string
          entry_code: string
          exited_at: string | null
          gate_location_id: string | null
          id: string
          purpose: string | null
          status: string
          vehicle_number: string
          visitor_visit_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          entered_at?: string
          entry_code: string
          exited_at?: string | null
          gate_location_id?: string | null
          id?: string
          purpose?: string | null
          status?: string
          vehicle_number: string
          visitor_visit_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          entered_at?: string
          entry_code?: string
          exited_at?: string | null
          gate_location_id?: string | null
          id?: string
          purpose?: string | null
          status?: string
          vehicle_number?: string
          visitor_visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_entries_gate_location_id_fkey"
            columns: ["gate_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_entries_visitor_visit_id_fkey"
            columns: ["visitor_visit_id"]
            isOneToOne: false
            referencedRelation: "visitor_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          approved_categories: Json
          bank_details: Json | null
          contact_person: string | null
          created_at: string
          customer_nominated: boolean
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean
          name: string
          nomination_evidence: string | null
          payment_terms: string
          phone: string | null
          quality_risk: string
          supplier_status: string
          updated_at: string
          vendor_code: string | null
        }
        Insert: {
          address?: string | null
          approved_categories?: Json
          bank_details?: Json | null
          contact_person?: string | null
          created_at?: string
          customer_nominated?: boolean
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name: string
          nomination_evidence?: string | null
          payment_terms?: string
          phone?: string | null
          quality_risk?: string
          supplier_status?: string
          updated_at?: string
          vendor_code?: string | null
        }
        Update: {
          address?: string | null
          approved_categories?: Json
          bank_details?: Json | null
          contact_person?: string | null
          created_at?: string
          customer_nominated?: boolean
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nomination_evidence?: string | null
          payment_terms?: string
          phone?: string | null
          quality_risk?: string
          supplier_status?: string
          updated_at?: string
          vendor_code?: string | null
        }
        Relationships: []
      }
      visitor_visits: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          expected_in: string | null
          expected_out: string | null
          facility_location_id: string | null
          host_user_id: string | null
          id: string
          id_reference: string | null
          phone: string | null
          purpose: string
          status: string
          updated_at: string
          visit_code: string
          visitor_name: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          expected_in?: string | null
          expected_out?: string | null
          facility_location_id?: string | null
          host_user_id?: string | null
          id?: string
          id_reference?: string | null
          phone?: string | null
          purpose: string
          status?: string
          updated_at?: string
          visit_code: string
          visitor_name: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          expected_in?: string | null
          expected_out?: string | null
          facility_location_id?: string | null
          host_user_id?: string | null
          id?: string
          id_reference?: string | null
          phone?: string | null
          purpose?: string
          status?: string
          updated_at?: string
          visit_code?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_visits_facility_location_id_fkey"
            columns: ["facility_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_materials: {
        Row: {
          bom_item_id: string | null
          component_id: string | null
          consumed_quantity: number
          created_at: string
          description: string | null
          id: string
          issued_quantity: number
          mpn: string | null
          required_quantity: number
          reservation_id: string | null
          reserved_quantity: number
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          bom_item_id?: string | null
          component_id?: string | null
          consumed_quantity?: number
          created_at?: string
          description?: string | null
          id?: string
          issued_quantity?: number
          mpn?: string | null
          required_quantity: number
          reservation_id?: string | null
          reserved_quantity?: number
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          bom_item_id?: string | null
          component_id?: string | null
          consumed_quantity?: number
          created_at?: string
          description?: string | null
          id?: string
          issued_quantity?: number
          mpn?: string | null
          required_quantity?: number
          reservation_id?: string | null
          reserved_quantity?: number
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_materials_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "project_bom_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          bom_id: string
          bom_snapshot: Json
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          demand_source_reference: string | null
          demand_source_type: string
          id: string
          notes: string | null
          owner_id: string | null
          planned_completion_date: string | null
          planned_start_date: string | null
          priority: string
          product_name: string
          product_variant: string | null
          project_id: string | null
          quantity_completed: number
          quantity_planned: number
          quantity_scrapped: number
          released_at: string | null
          released_by: string | null
          route_id: string | null
          route_snapshot: Json
          status: string
          updated_at: string
          work_order_number: string
        }
        Insert: {
          bom_id: string
          bom_snapshot?: Json
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          demand_source_reference?: string | null
          demand_source_type?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          planned_completion_date?: string | null
          planned_start_date?: string | null
          priority?: string
          product_name: string
          product_variant?: string | null
          project_id?: string | null
          quantity_completed?: number
          quantity_planned: number
          quantity_scrapped?: number
          released_at?: string | null
          released_by?: string | null
          route_id?: string | null
          route_snapshot?: Json
          status?: string
          updated_at?: string
          work_order_number: string
        }
        Update: {
          bom_id?: string
          bom_snapshot?: Json
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          demand_source_reference?: string | null
          demand_source_type?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          planned_completion_date?: string | null
          planned_start_date?: string | null
          priority?: string
          product_name?: string
          product_variant?: string | null
          project_id?: string | null
          quantity_completed?: number
          quantity_planned?: number
          quantity_scrapped?: number
          released_at?: string | null
          released_by?: string | null
          route_id?: string | null
          route_snapshot?: Json
          status?: string
          updated_at?: string
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "project_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "production_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_allocations: {
        Row: {
          allocated_at: string
          allocated_by: string | null
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          released_at: string | null
          workstation_id: string
        }
        Insert: {
          allocated_at?: string
          allocated_by?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          workstation_id: string
        }
        Update: {
          allocated_at?: string
          allocated_by?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_allocations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstation_allocations_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstations: {
        Row: {
          created_at: string
          facility_location_id: string | null
          id: string
          name: string
          qr_payload: string
          status: string
          updated_at: string
          workstation_code: string
          workstation_type: string
        }
        Insert: {
          created_at?: string
          facility_location_id?: string | null
          id?: string
          name: string
          qr_payload: string
          status?: string
          updated_at?: string
          workstation_code: string
          workstation_type?: string
        }
        Update: {
          created_at?: string
          facility_location_id?: string | null
          id?: string
          name?: string
          qr_payload?: string
          status?: string
          updated_at?: string
          workstation_code?: string
          workstation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstations_facility_location_id_fkey"
            columns: ["facility_location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      operational_receiving_purchase_order_items: {
        Row: {
          component_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          mpn: string | null
          po_id: string | null
          quantity_ordered: number | null
          quantity_received: number | null
          quantity_rejected: number | null
          short_close_reason: string | null
          short_closed: boolean | null
        }
        Insert: {
          component_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          mpn?: string | null
          po_id?: string | null
          quantity_ordered?: number | null
          quantity_received?: number | null
          quantity_rejected?: number | null
          short_close_reason?: string | null
          short_closed?: boolean | null
        }
        Update: {
          component_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          mpn?: string | null
          po_id?: string | null
          quantity_ordered?: number | null
          quantity_received?: number | null
          quantity_rejected?: number | null
          short_close_reason?: string | null
          short_closed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "operational_receiving_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_receiving_purchase_orders: {
        Row: {
          created_at: string | null
          expected_delivery_date: string | null
          id: string | null
          notes: string | null
          po_number: string | null
          status: string | null
          updated_at: string | null
          vendor_address: string | null
          vendor_contact_person: string | null
          vendor_email: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_inward: { Args: { _uid: string }; Returns: boolean }
      can_manage_leave: { Args: { _uid: string }; Returns: boolean }
      can_manage_onboarding: { Args: { _uid: string }; Returns: boolean }
      can_manage_recruitment: { Args: { _uid: string }; Returns: boolean }
      can_manage_training: { Args: { _uid: string }; Returns: boolean }
      can_purchase: { Args: { _uid: string }; Returns: boolean }
      complete_automation_lease: {
        Args: { _error?: string; _job_key: string; _pause?: boolean }
        Returns: undefined
      }
      create_grn:
        | {
            Args: {
              _items: Json
              _po_id: string
              _storage_notes: string
              _vendor_invoice_date: string
              _vendor_invoice_number: string
            }
            Returns: Json
          }
        | {
            Args: {
              _idempotency_key?: string
              _items: Json
              _po_id: string
              _storage_notes: string
              _vendor_invoice_date: string
              _vendor_invoice_number: string
            }
            Returns: Json
          }
      create_phase6_quotation: {
        Args: {
          _items: Json
          _lead_time_days: number
          _payment_terms: string
          _quoted_at: string
          _rfq_id: string
          _valid_until: string
          _vendor_id: string
        }
        Returns: string
      }
      create_phase6_rfq: {
        Args: {
          _project_id: string
          _purchase_request_id: string
          _response_due_date: string
          _terms: string
          _vendor_ids?: string[]
        }
        Returns: string
      }
      create_phase7_dispatch: {
        Args: {
          _carrier_name?: string
          _customer_id?: string
          _notes?: string
          _recipient_name?: string
          _tracking_reference?: string
          _unit_ids?: string[]
        }
        Returns: string
      }
      create_phase7_ppap_package: {
        Args: {
          _customer_id?: string
          _evidence_notes?: string
          _revision?: string
          _work_order_id: string
        }
        Returns: string
      }
      create_phase7_work_order: {
        Args: {
          _bom_id: string
          _notes: string
          _planned_completion_date: string
          _planned_start_date: string
          _priority: string
          _product_name: string
          _product_variant: string
          _project_id: string
          _quantity_planned: number
          _route_id: string
        }
        Returns: string
      }
      create_purchase_order: {
        Args: {
          _expected_delivery_date: string
          _items: Json
          _notes: string
          _tax_amount: number
          _vendor_id: string
        }
        Returns: Json
      }
      create_purchase_request_from_bom_shortage: {
        Args: { _bom_id: string; _required_date?: string }
        Returns: string
      }
      decide_incoming_inspection: {
        Args: { _findings?: string; _inspection_id: string; _status: string }
        Returns: undefined
      }
      decide_phase7_finished_goods_release: {
        Args: {
          _notes?: string
          _packaging_reference?: string
          _production_unit_id: string
          _status: string
        }
        Returns: string
      }
      decide_phase7_ppap_package: {
        Args: { _notes?: string; _package_id: string; _status: string }
        Returns: undefined
      }
      disposition_phase7_ncr: {
        Args: { _ncr_id: string; _notes?: string; _status: string }
        Returns: undefined
      }
      ensure_phase5_project_access_catalog: { Args: never; Returns: undefined }
      external_contact_has_access: {
        Args: { _contact_id: string; _portal_type?: string }
        Returns: boolean
      }
      external_current_contact_id: {
        Args: { _user_id?: string }
        Returns: string
      }
      external_current_party_id: { Args: never; Returns: string }
      external_is_current_contact: {
        Args: { _contact_id: string }
        Returns: boolean
      }
      external_is_staff_manager: { Args: never; Returns: boolean }
      external_log_access: {
        Args: {
          _entity_id: string
          _entity_type: string
          _event_type: string
          _metadata?: Json
          _snapshot_id?: string
        }
        Returns: undefined
      }
      get_drive_breadcrumbs: {
        Args: { p_node_id: string }
        Returns: {
          depth: number
          id: string
          name: string
          node_type: string
        }[]
      }
      get_public_application_status: {
        Args: { _status_token: string }
        Returns: {
          application_id: string
          role_title: string
          stage: string
          status: string
          submitted_at: string
        }[]
      }
      has_any_permission: {
        Args: { _permission_keys: string[]; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inventory_payload_hash: { Args: { _payload: Json }; Returns: string }
      inventory_request_result: {
        Args: {
          _payload: Json
          _request_key: string
          _transaction_type: string
        }
        Returns: Json
      }
      is_employee_manager: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      mark_po_sent: {
        Args: { _address: string; _po_id: string }
        Returns: Json
      }
      next_business_number: {
        Args: {
          _department_code?: string
          _entity_type: string
          _project_code?: string
        }
        Returns: string
      }
      next_document_number: { Args: { _kind: string }; Returns: string }
      phase6_can_finance: { Args: { _uid: string }; Returns: boolean }
      phase6_can_quality: { Args: { _uid: string }; Returns: boolean }
      phase6_shortage_snapshot: {
        Args: { _bom_id: string }
        Returns: {
          available: number
          bom_item_id: string
          component_id: string
          mpn: string
          on_hand: number
          open_po: number
          quality_hold: number
          required_quantity: number
          reserved: number
          shortage: number
        }[]
      }
      phase7_can_production: { Args: { _uid: string }; Returns: boolean }
      phase8_can: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      post_material_issue: {
        Args: {
          _assignee_id: string
          _idempotency_key: string
          _items: Json
          _notes: string
          _project_id: string
          _project_name: string
        }
        Returns: Json
      }
      post_material_return: {
        Args: {
          _assignment_id: string
          _idempotency_key: string
          _quantity: number
        }
        Returns: Json
      }
      post_stock_adjustment: {
        Args: {
          _component_id: string
          _delta: number
          _idempotency_key: string
          _location_id: string
          _reason: string
        }
        Returns: Json
      }
      post_stock_transfer: {
        Args: {
          _component_id: string
          _from_location_id: string
          _idempotency_key: string
          _notes: string
          _quantity: number
          _to_location_id: string
        }
        Returns: Json
      }
      provision_drive_for_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      record_phase7_unit_execution: {
        Args: {
          _notes?: string
          _production_unit_id: string
          _route_step_id: string
          _status: string
          _work_order_id: string
        }
        Returns: string
      }
      record_phase7_unit_inspection: {
        Args: {
          _findings?: string
          _production_unit_id: string
          _result: string
          _route_step_id: string
          _work_order_id: string
        }
        Returns: string
      }
      record_phase7_unit_test: {
        Args: {
          _notes?: string
          _production_unit_id: string
          _result: string
          _test_type: string
          _work_order_id: string
        }
        Returns: string
      }
      review_phase6_record: {
        Args: {
          _decision: string
          _notes?: string
          _record_id: string
          _record_type: string
        }
        Returns: undefined
      }
      short_close_po_item: {
        Args: { _item_id: string; _reason: string; _undo?: boolean }
        Returns: Json
      }
      submit_public_job_application:
        | {
            Args: {
              _cover_letter: string
              _current_location: string
              _email: string
              _full_name: string
              _phone: string
              _posting_slug: string
            }
            Returns: Json
          }
        | {
            Args: {
              _cover_letter: string
              _current_location: string
              _email: string
              _full_name: string
              _phone: string
              _posting_slug: string
              _resume_file_size?: number
              _resume_filename?: string
              _resume_mime_type?: string
              _resume_storage_path?: string
            }
            Returns: Json
          }
      toggle_node_star: { Args: { p_node_id: string }; Returns: boolean }
      transition_phase7_work_order: {
        Args: { _notes?: string; _status: string; _work_order_id: string }
        Returns: undefined
      }
      try_acquire_automation_lease: {
        Args: { _job_key: string; _lease_seconds?: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "member"
        | "purchase"
        | "storekeeper"
        | "project_manager"
        | "lead_engineer"
      department_type:
        | "hardware"
        | "firmware"
        | "mechanical"
        | "qa"
        | "procurement"
        | "production"
        | "executive"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "in_review" | "blocked" | "done"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "member",
        "purchase",
        "storekeeper",
        "project_manager",
        "lead_engineer",
      ],
      department_type: [
        "hardware",
        "firmware",
        "mechanical",
        "qa",
        "procurement",
        "production",
        "executive",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "in_review", "blocked", "done"],
    },
  },
} as const
