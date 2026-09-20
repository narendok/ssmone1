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
          requirement_number: string
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
          requirement_number: string
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
          requirement_number?: string
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
          id: string
          is_active: boolean
          key: string
          label: string
          metadata: Json
          prefix_template: string
          serial_padding: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          metadata?: Json
          prefix_template: string
          serial_padding?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          metadata?: Json
          prefix_template?: string
          serial_padding?: number
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
      goods_receipt_items: {
        Row: {
          component_id: string
          created_at: string
          grn_id: string
          id: string
          location_id: string | null
          lot_number: string | null
          po_item_id: string | null
          quantity_received: number
          quantity_rejected: number
          rejection_note: string | null
          rejection_reason: string | null
        }
        Insert: {
          component_id: string
          created_at?: string
          grn_id: string
          id?: string
          location_id?: string | null
          lot_number?: string | null
          po_item_id?: string | null
          quantity_received: number
          quantity_rejected?: number
          rejection_note?: string | null
          rejection_reason?: string | null
        }
        Update: {
          component_id?: string
          created_at?: string
          grn_id?: string
          id?: string
          location_id?: string | null
          lot_number?: string | null
          po_item_id?: string | null
          quantity_received?: number
          quantity_rejected?: number
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
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_notes: {
        Row: {
          created_at: string
          grn_number: string
          id: string
          po_id: string | null
          received_by: string | null
          storage_location_notes: string | null
          vendor_invoice_date: string | null
          vendor_invoice_number: string
        }
        Insert: {
          created_at?: string
          grn_number: string
          id?: string
          po_id?: string | null
          received_by?: string | null
          storage_location_notes?: string | null
          vendor_invoice_date?: string | null
          vendor_invoice_number: string
        }
        Update: {
          created_at?: string
          grn_number?: string
          id?: string
          po_id?: string | null
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
      hr_job_requisitions: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          employment_type: string
          headcount: number
          hiring_manager_user_id: string | null
          id: string
          justification: string | null
          location: string | null
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
          justification?: string | null
          location?: string | null
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
          justification?: string | null
          location?: string | null
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
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          po_number: string
          sent_at: string | null
          sent_by: string | null
          sent_to: string | null
          status: string
          tax_amount: number
          total_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          po_number: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
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
      rd_members: {
        Row: {
          active: boolean
          created_at: string
          department: Database["public"]["Enums"]["department_type"] | null
          email: string
          id: string
          name: string
          role: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          email: string
          id?: string
          name: string
          role?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"] | null
          email?: string
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      requirement_baselines: {
        Row: {
          approved_at: string
          approved_by: string | null
          baseline_number: string
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
          baseline_number: string
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
          baseline_number?: string
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
          enquiry_number: string
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
          enquiry_number: string
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
          enquiry_number?: string
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
          opportunity_number: string
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
          opportunity_number: string
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
          opportunity_number?: string
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
      vendors: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean
          name: string
          payment_terms: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_terms?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_terms?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_inward: { Args: { _uid: string }; Returns: boolean }
      can_manage_leave: { Args: { _uid: string }; Returns: boolean }
      can_manage_onboarding: { Args: { _uid: string }; Returns: boolean }
      can_manage_recruitment: { Args: { _uid: string }; Returns: boolean }
      can_manage_training: { Args: { _uid: string }; Returns: boolean }
      can_purchase: { Args: { _uid: string }; Returns: boolean }
      create_grn: {
        Args: {
          _items: Json
          _po_id: string
          _storage_notes: string
          _vendor_invoice_date: string
          _vendor_invoice_number: string
        }
        Returns: Json
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
      is_employee_manager: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      mark_po_sent: {
        Args: { _address: string; _po_id: string }
        Returns: Json
      }
      next_document_number: { Args: { _kind: string }; Returns: string }
      provision_drive_for_project: {
        Args: { p_project_id: string }
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
