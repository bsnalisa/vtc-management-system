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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alumni: {
        Row: {
          active: boolean
          alternative_phone: string | null
          created_at: string
          current_address: string | null
          email: string | null
          final_level: number | null
          final_trade_id: string | null
          graduation_date: string | null
          graduation_year: number
          id: string
          linkedin_profile: string | null
          national_id: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          trainee_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          alternative_phone?: string | null
          created_at?: string
          current_address?: string | null
          email?: string | null
          final_level?: number | null
          final_trade_id?: string | null
          graduation_date?: string | null
          graduation_year: number
          id?: string
          linkedin_profile?: string | null
          national_id?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          trainee_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          alternative_phone?: string | null
          created_at?: string
          current_address?: string | null
          email?: string | null
          final_level?: number | null
          final_trade_id?: string | null
          graduation_date?: string | null
          graduation_year?: number
          id?: string
          linkedin_profile?: string | null
          national_id?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          trainee_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      alumni_announcements: {
        Row: {
          announcement_type: string
          content: string
          created_at: string
          expires_at: string | null
          id: string
          organization_id: string
          priority: string
          published_at: string | null
          published_by: string
          status: string
          target_graduation_years: number[] | null
          target_trade_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id: string
          priority?: string
          published_at?: string | null
          published_by: string
          status?: string
          target_graduation_years?: number[] | null
          target_trade_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          priority?: string
          published_at?: string | null
          published_by?: string
          status?: string
          target_graduation_years?: number[] | null
          target_trade_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      alumni_employment: {
        Row: {
          alumni_id: string
          created_at: string
          employer_name: string
          employment_type: string
          end_date: string | null
          id: string
          industry: string | null
          is_current: boolean
          job_description: string | null
          location: string | null
          organization_id: string
          position: string
          salary_range: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          alumni_id: string
          created_at?: string
          employer_name: string
          employment_type?: string
          end_date?: string | null
          id?: string
          industry?: string | null
          is_current?: boolean
          job_description?: string | null
          location?: string | null
          organization_id: string
          position: string
          salary_range?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          alumni_id?: string
          created_at?: string
          employer_name?: string
          employment_type?: string
          end_date?: string | null
          id?: string
          industry?: string | null
          is_current?: boolean
          job_description?: string | null
          location?: string | null
          organization_id?: string
          position?: string
          salary_range?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      alumni_event_registrations: {
        Row: {
          alumni_id: string
          attendance_status: string
          created_at: string
          event_id: string
          id: string
          notes: string | null
          organization_id: string
          registration_date: string
        }
        Insert: {
          alumni_id: string
          attendance_status?: string
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          organization_id: string
          registration_date?: string
        }
        Update: {
          alumni_id?: string
          attendance_status?: string
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          registration_date?: string
        }
        Relationships: []
      }
      alumni_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_name: string
          event_time: string | null
          event_type: string
          id: string
          location: string | null
          max_attendees: number | null
          organization_id: string
          organizer_id: string
          registration_deadline: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_name: string
          event_time?: string | null
          event_type: string
          id?: string
          location?: string | null
          max_attendees?: number | null
          organization_id: string
          organizer_id: string
          registration_deadline?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_name?: string
          event_time?: string | null
          event_type?: string
          id?: string
          location?: string | null
          max_attendees?: number | null
          organization_id?: string
          organizer_id?: string
          registration_deadline?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean | null
          content: string
          created_at: string
          expires_at: string | null
          id: string
          organization_id: string | null
          priority: string
          published_at: string
          published_by: string
          target_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string | null
          priority?: string
          published_at?: string
          published_by: string
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          organization_id?: string | null
          priority?: string
          published_at?: string
          published_by?: string
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_drafts: {
        Row: {
          created_at: string
          current_tab: string | null
          form_data: Json
          id: string
          last_updated_at: string
          organization_id: string | null
          progress_percentage: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_tab?: string | null
          form_data?: Json
          id?: string
          last_updated_at?: string
          organization_id?: string | null
          progress_percentage?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_tab?: string | null
          form_data?: Json
          id?: string
          last_updated_at?: string
          organization_id?: string | null
          progress_percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          assessed_by: string | null
          assessment_date: string | null
          competency_status: string | null
          created_at: string
          enrollment_id: string
          id: string
          marks_obtained: number | null
          remarks: string | null
          trainee_id: string
          unit_standard_id: string
          updated_at: string
        }
        Insert: {
          assessed_by?: string | null
          assessment_date?: string | null
          competency_status?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          marks_obtained?: number | null
          remarks?: string | null
          trainee_id: string
          unit_standard_id: string
          updated_at?: string
        }
        Update: {
          assessed_by?: string | null
          assessment_date?: string | null
          competency_status?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          marks_obtained?: number | null
          remarks?: string | null
          trainee_id?: string
          unit_standard_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "trainee_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_unit_standard_id_fkey"
            columns: ["unit_standard_id"]
            isOneToOne: false
            referencedRelation: "unit_standards"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          weight: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          weight: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          weight?: number
        }
        Relationships: []
      }
      assessments: {
        Row: {
          academic_year: string
          assessment_type_id: string
          course_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          max_marks: number
          term: number
          updated_at: string
        }
        Insert: {
          academic_year: string
          assessment_type_id: string
          course_id: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          max_marks?: number
          term: number
          updated_at?: string
        }
        Update: {
          academic_year?: string
          assessment_type_id?: string
          course_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          max_marks?: number
          term?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessment_type_id_fkey"
            columns: ["assessment_type_id"]
            isOneToOne: false
            referencedRelation: "assessment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_audit_logs: {
        Row: {
          action: string
          asset_id: string
          changed_by: string
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
        }
        Insert: {
          action: string
          asset_id: string
          changed_by: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          asset_id?: string
          changed_by?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_audit_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciation: {
        Row: {
          asset_id: string
          calculation_date: string
          closing_value: number
          created_at: string
          depreciation_amount: number
          depreciation_year: number
          id: string
          notes: string | null
          opening_value: number
          organization_id: string
        }
        Insert: {
          asset_id: string
          calculation_date?: string
          closing_value: number
          created_at?: string
          depreciation_amount: number
          depreciation_year: number
          id?: string
          notes?: string | null
          opening_value: number
          organization_id: string
        }
        Update: {
          asset_id?: string
          calculation_date?: string
          closing_value?: number
          created_at?: string
          depreciation_amount?: number
          depreciation_year?: number
          id?: string
          notes?: string | null
          opening_value?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_depreciation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_documents: {
        Row: {
          asset_id: string
          created_at: string
          document_name: string
          document_type: string
          file_path: string
          file_size: number | null
          id: string
          organization_id: string
          uploaded_by: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          document_name: string
          document_type: string
          file_path: string
          file_size?: number | null
          id?: string
          organization_id: string
          uploaded_by: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          document_name?: string
          document_type?: string
          file_path?: string
          file_size?: number | null
          id?: string
          organization_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          created_by: string
          description: string
          id: string
          maintenance_date: string
          maintenance_type: string
          next_maintenance_date: string | null
          notes: string | null
          organization_id: string
          performed_by: string | null
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          maintenance_date: string
          maintenance_type: string
          next_maintenance_date?: string | null
          notes?: string | null
          organization_id: string
          performed_by?: string | null
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          next_maintenance_date?: string | null
          notes?: string | null
          organization_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          active: boolean
          asset_code: string
          asset_name: string
          assigned_department: string | null
          assigned_user: string | null
          category_id: string
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          current_value: number | null
          depreciation_rate: number | null
          description: string | null
          id: string
          location: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          organization_id: string
          purchase_cost: number
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          useful_life_years: number | null
          warranty_expiry: string | null
        }
        Insert: {
          active?: boolean
          asset_code: string
          asset_name: string
          assigned_department?: string | null
          assigned_user?: string | null
          category_id: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          current_value?: number | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          organization_id: string
          purchase_cost?: number
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          useful_life_years?: number | null
          warranty_expiry?: string | null
        }
        Update: {
          active?: boolean
          asset_code?: string
          asset_name?: string
          assigned_department?: string | null
          assigned_user?: string | null
          category_id?: string
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          current_value?: number | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          organization_id?: string
          purchase_cost?: number
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          useful_life_years?: number | null
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
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          present: boolean
          register_id: string
          remarks: string | null
          trainee_id: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          present?: boolean
          register_id: string
          remarks?: string | null
          trainee_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          present?: boolean
          register_id?: string
          remarks?: string | null
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "attendance_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_registers: {
        Row: {
          academic_year: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          level: number
          organization_id: string | null
          start_date: string
          trade_id: string
          trainer_id: string
          training_mode: Database["public"]["Enums"]["training_mode"]
        }
        Insert: {
          academic_year: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          level: number
          organization_id?: string | null
          start_date: string
          trade_id: string
          trainer_id: string
          training_mode: Database["public"]["Enums"]["training_mode"]
        }
        Update: {
          academic_year?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          level?: number
          organization_id?: string | null
          start_date?: string
          trade_id?: string
          trainer_id?: string
          training_mode?: Database["public"]["Enums"]["training_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_registers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_registers_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_registers_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_records: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          invoice_no: string | null
          metadata: Json | null
          organization_id: string
          organization_package_id: string | null
          payment_date: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string | null
          metadata?: Json | null
          organization_id: string
          organization_package_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string | null
          metadata?: Json | null
          organization_id?: string
          organization_package_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_organization_package_id_fkey"
            columns: ["organization_package_id"]
            isOneToOne: false
            referencedRelation: "organization_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_operations: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error_log: Json | null
          failed_items: number
          id: string
          operation_type: string
          organization_id: string | null
          processed_items: number
          started_at: string | null
          status: string
          total_items: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_log?: Json | null
          failed_items?: number
          id?: string
          operation_type: string
          organization_id?: string | null
          processed_items?: number
          started_at?: string | null
          status?: string
          total_items?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_log?: Json | null
          failed_items?: number
          id?: string
          operation_type?: string
          organization_id?: string | null
          processed_items?: number
          started_at?: string | null
          status?: string
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "bulk_operations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrolled_date: string
          id: string
          status: string
          trainee_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_date?: string
          id?: string
          status?: string
          trainee_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_date?: string
          id?: string
          status?: string
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          active: boolean | null
          capacity: number | null
          class_code: string
          class_name: string
          created_at: string
          id: string
          level: number
          organization_id: string | null
          trade_id: string
          trainer_id: string | null
          training_mode: Database["public"]["Enums"]["training_mode"]
          updated_at: string
        }
        Insert: {
          academic_year: string
          active?: boolean | null
          capacity?: number | null
          class_code: string
          class_name: string
          created_at?: string
          id?: string
          level: number
          organization_id?: string | null
          trade_id: string
          trainer_id?: string | null
          training_mode: Database["public"]["Enums"]["training_mode"]
          updated_at?: string
        }
        Update: {
          academic_year?: string
          active?: boolean | null
          capacity?: number | null
          class_code?: string
          class_name?: string
          created_at?: string
          id?: string
          level?: number
          organization_id?: string | null
          trade_id?: string
          trainer_id?: string | null
          training_mode?: Database["public"]["Enums"]["training_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      course_unit_standards: {
        Row: {
          course_id: string
          created_at: string
          id: string
          unit_standard_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          unit_standard_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          unit_standard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_unit_standards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_unit_standards_unit_standard_id_fkey"
            columns: ["unit_standard_id"]
            isOneToOne: false
            referencedRelation: "unit_standards"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active: boolean
          code: string
          created_at: string
          credits: number | null
          description: string | null
          id: string
          level: number
          name: string
          trade_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          credits?: number | null
          description?: string | null
          id?: string
          level: number
          name: string
          trade_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          credits?: number | null
          description?: string | null
          id?: string
          level?: number
          name?: string
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system_role: boolean
          organization_id: string | null
          role_code: string
          role_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean
          organization_id?: string | null
          role_code: string
          role_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean
          organization_id?: string | null
          role_code?: string
          role_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_budgets: {
        Row: {
          budget_year: string
          created_at: string
          department: string
          id: string
          organization_id: string
          remaining_amount: number | null
          spent_amount: number
          total_budget: number
          updated_at: string
        }
        Insert: {
          budget_year: string
          created_at?: string
          department: string
          id?: string
          organization_id: string
          remaining_amount?: number | null
          spent_amount?: number
          total_budget: number
          updated_at?: string
        }
        Update: {
          budget_year?: string
          created_at?: string
          department?: string
          id?: string
          organization_id?: string
          remaining_amount?: number | null
          spent_amount?: number
          total_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          academic_year: string | null
          document_type: string
          file_path: string | null
          generated_at: string
          generated_by: string
          id: string
          trainee_id: string | null
        }
        Insert: {
          academic_year?: string | null
          document_type: string
          file_path?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          trainee_id?: string | null
        }
        Update: {
          academic_year?: string | null
          document_type?: string
          file_path?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          trainee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_interactions: {
        Row: {
          conducted_by: string
          created_at: string
          employer_id: string
          follow_up_date: string | null
          id: string
          interaction_date: string
          interaction_type: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          conducted_by: string
          created_at?: string
          employer_id: string
          follow_up_date?: string | null
          id?: string
          interaction_date?: string
          interaction_type: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          conducted_by?: string
          created_at?: string
          employer_id?: string
          follow_up_date?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_interactions_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employers: {
        Row: {
          active: boolean
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          notes: string | null
          organization_id: string
          rating: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          organization_id: string
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      entry_requirements: {
        Row: {
          active: boolean | null
          additional_requirements: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          english_symbol: string | null
          id: string
          level: number
          maths_symbol: string | null
          mature_age_entry: boolean | null
          mature_min_age: number | null
          mature_min_experience_years: number | null
          min_grade: number | null
          min_points: number | null
          organization_id: string
          pending_changes: Json | null
          previous_level_required: number | null
          prevocational_symbol: string | null
          required_subjects: Json | null
          requirement_name: string
          requires_approval: boolean | null
          requires_previous_level: boolean | null
          science_symbol: string | null
          trade_id: string
          updated_at: string
          version_number: number | null
        }
        Insert: {
          active?: boolean | null
          additional_requirements?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          english_symbol?: string | null
          id?: string
          level: number
          maths_symbol?: string | null
          mature_age_entry?: boolean | null
          mature_min_age?: number | null
          mature_min_experience_years?: number | null
          min_grade?: number | null
          min_points?: number | null
          organization_id: string
          pending_changes?: Json | null
          previous_level_required?: number | null
          prevocational_symbol?: string | null
          required_subjects?: Json | null
          requirement_name: string
          requires_approval?: boolean | null
          requires_previous_level?: boolean | null
          science_symbol?: string | null
          trade_id: string
          updated_at?: string
          version_number?: number | null
        }
        Update: {
          active?: boolean | null
          additional_requirements?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          english_symbol?: string | null
          id?: string
          level?: number
          maths_symbol?: string | null
          mature_age_entry?: boolean | null
          mature_min_age?: number | null
          mature_min_experience_years?: number | null
          min_grade?: number | null
          min_points?: number | null
          organization_id?: string
          pending_changes?: Json | null
          previous_level_required?: number | null
          prevocational_symbol?: string | null
          required_subjects?: Json | null
          requirement_name?: string
          requires_approval?: boolean | null
          requires_previous_level?: boolean | null
          science_symbol?: string | null
          trade_id?: string
          updated_at?: string
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_requirements_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_requirements_history: {
        Row: {
          additional_requirements: string | null
          change_reason: string | null
          changed_by: string
          created_at: string
          english_symbol: string | null
          entry_requirement_id: string
          id: string
          level: number
          maths_symbol: string | null
          mature_age_entry: boolean | null
          mature_min_age: number | null
          mature_min_experience_years: number | null
          min_grade: number | null
          min_points: number | null
          organization_id: string
          previous_level_required: number | null
          prevocational_symbol: string | null
          required_subjects: Json | null
          requirement_name: string
          requires_previous_level: boolean | null
          science_symbol: string | null
          trade_id: string
          version_number: number
        }
        Insert: {
          additional_requirements?: string | null
          change_reason?: string | null
          changed_by: string
          created_at?: string
          english_symbol?: string | null
          entry_requirement_id: string
          id?: string
          level: number
          maths_symbol?: string | null
          mature_age_entry?: boolean | null
          mature_min_age?: number | null
          mature_min_experience_years?: number | null
          min_grade?: number | null
          min_points?: number | null
          organization_id: string
          previous_level_required?: number | null
          prevocational_symbol?: string | null
          required_subjects?: Json | null
          requirement_name: string
          requires_previous_level?: boolean | null
          science_symbol?: string | null
          trade_id: string
          version_number?: number
        }
        Update: {
          additional_requirements?: string | null
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          english_symbol?: string | null
          entry_requirement_id?: string
          id?: string
          level?: number
          maths_symbol?: string | null
          mature_age_entry?: boolean | null
          mature_min_age?: number | null
          mature_min_experience_years?: number | null
          min_grade?: number | null
          min_points?: number | null
          organization_id?: string
          previous_level_required?: number | null
          prevocational_symbol?: string | null
          required_subjects?: Json | null
          requirement_name?: string
          requires_previous_level?: boolean | null
          science_symbol?: string | null
          trade_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_requirements_history_entry_requirement_id_fkey"
            columns: ["entry_requirement_id"]
            isOneToOne: false
            referencedRelation: "entry_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_records: {
        Row: {
          academic_year: string
          amount_paid: number
          balance: number | null
          created_at: string
          id: string
          organization_id: string | null
          total_fee: number
          trainee_id: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          amount_paid?: number
          balance?: number | null
          created_at?: string
          id?: string
          organization_id?: string | null
          total_fee: number
          trainee_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          amount_paid?: number
          balance?: number | null
          created_at?: string
          id?: string
          organization_id?: string | null
          total_fee?: number
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_records_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_records_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          active: boolean
          applicable_to: string[] | null
          category: string
          code: string
          created_at: string
          created_by: string | null
          default_amount: number
          description: string | null
          id: string
          is_mandatory: boolean
          is_recurring: boolean
          name: string
          organization_id: string
          recurring_frequency: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          applicable_to?: string[] | null
          category: string
          code: string
          created_at?: string
          created_by?: string | null
          default_amount?: number
          description?: string | null
          id?: string
          is_mandatory?: boolean
          is_recurring?: boolean
          name: string
          organization_id: string
          recurring_frequency?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          applicable_to?: string[] | null
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          default_amount?: number
          description?: string | null
          id?: string
          is_mandatory?: boolean
          is_recurring?: boolean
          name?: string
          organization_id?: string
          recurring_frequency?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_queue: {
        Row: {
          amount: number
          amount_paid: number
          balance: number | null
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          fee_type_id: string | null
          id: string
          organization_id: string
          payment_method: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_paid?: number
          balance?: number | null
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          fee_type_id?: string | null
          id?: string
          organization_id: string
          payment_method?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          balance?: number | null
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          fee_type_id?: string | null
          id?: string
          organization_id?: string
          payment_method?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_queue_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          academic_year: string | null
          account_id: string
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          fee_type_id: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          processed_at: string
          processed_by: string | null
          reference_number: string | null
          transaction_type: string
        }
        Insert: {
          academic_year?: string | null
          account_id: string
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          processed_at?: string
          processed_by?: string | null
          reference_number?: string | null
          transaction_type: string
        }
        Update: {
          academic_year?: string | null
          account_id?: string
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          processed_at?: string
          processed_by?: string | null
          reference_number?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trainee_financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          generated_by: string
          id: string
          metadata: Json | null
          organization_id: string
          template_name: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          generated_by: string
          id?: string
          metadata?: Json | null
          organization_id: string
          template_name: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          generated_by?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_allocations: {
        Row: {
          actual_check_out_date: string | null
          allocated_by: string
          bed_id: string
          building_id: string
          check_in_date: string
          checked_out_by: string | null
          created_at: string
          expected_check_out_date: string | null
          id: string
          monthly_fee: number
          notes: string | null
          organization_id: string
          room_id: string
          status: Database["public"]["Enums"]["allocation_status"]
          trainee_id: string
          updated_at: string
        }
        Insert: {
          actual_check_out_date?: string | null
          allocated_by: string
          bed_id: string
          building_id: string
          check_in_date: string
          checked_out_by?: string | null
          created_at?: string
          expected_check_out_date?: string | null
          id?: string
          monthly_fee: number
          notes?: string | null
          organization_id: string
          room_id: string
          status?: Database["public"]["Enums"]["allocation_status"]
          trainee_id: string
          updated_at?: string
        }
        Update: {
          actual_check_out_date?: string | null
          allocated_by?: string
          bed_id?: string
          building_id?: string
          check_in_date?: string
          checked_out_by?: string | null
          created_at?: string
          expected_check_out_date?: string | null
          id?: string
          monthly_fee?: number
          notes?: string | null
          organization_id?: string
          room_id?: string
          status?: Database["public"]["Enums"]["allocation_status"]
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_allocations_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "hostel_beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "hostel_buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_beds: {
        Row: {
          bed_number: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          room_id: string
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }
        Insert: {
          bed_number: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          room_id: string
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
        }
        Update: {
          bed_number?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          room_id?: string
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_buildings: {
        Row: {
          active: boolean
          building_code: string
          building_name: string
          created_at: string
          current_occupancy: number
          description: string | null
          gender_type: Database["public"]["Enums"]["gender_type"]
          id: string
          location: string | null
          organization_id: string
          total_capacity: number
          total_floors: number
          total_rooms: number
          updated_at: string
          warden_contact: string | null
          warden_name: string | null
        }
        Insert: {
          active?: boolean
          building_code: string
          building_name: string
          created_at?: string
          current_occupancy?: number
          description?: string | null
          gender_type: Database["public"]["Enums"]["gender_type"]
          id?: string
          location?: string | null
          organization_id: string
          total_capacity?: number
          total_floors?: number
          total_rooms?: number
          updated_at?: string
          warden_contact?: string | null
          warden_name?: string | null
        }
        Update: {
          active?: boolean
          building_code?: string
          building_name?: string
          created_at?: string
          current_occupancy?: number
          description?: string | null
          gender_type?: Database["public"]["Enums"]["gender_type"]
          id?: string
          location?: string | null
          organization_id?: string
          total_capacity?: number
          total_floors?: number
          total_rooms?: number
          updated_at?: string
          warden_contact?: string | null
          warden_name?: string | null
        }
        Relationships: []
      }
      hostel_fees: {
        Row: {
          allocation_id: string | null
          amount_paid: number
          balance: number | null
          created_at: string
          due_date: string
          fee_amount: number
          fee_month: string
          id: string
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_status: string
          trainee_id: string
          updated_at: string
        }
        Insert: {
          allocation_id?: string | null
          amount_paid?: number
          balance?: number | null
          created_at?: string
          due_date: string
          fee_amount: number
          fee_month: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_date?: string | null
          payment_status?: string
          trainee_id: string
          updated_at?: string
        }
        Update: {
          allocation_id?: string | null
          amount_paid?: number
          balance?: number | null
          created_at?: string
          due_date?: string
          fee_amount?: number
          fee_month?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_date?: string | null
          payment_status?: string
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_fees_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "hostel_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_maintenance_issues: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          building_id: string | null
          created_at: string
          description: string
          estimated_cost: number | null
          id: string
          issue_number: string
          issue_type: string
          organization_id: string
          priority: string
          reported_by: string
          reported_date: string
          resolution_notes: string | null
          resolved_date: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["hostel_maintenance_status"]
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          building_id?: string | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          id?: string
          issue_number: string
          issue_type: string
          organization_id: string
          priority?: string
          reported_by: string
          reported_date?: string
          resolution_notes?: string | null
          resolved_date?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["hostel_maintenance_status"]
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          building_id?: string | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          id?: string
          issue_number?: string
          issue_type?: string
          organization_id?: string
          priority?: string
          reported_by?: string
          reported_date?: string
          resolution_notes?: string | null
          resolved_date?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["hostel_maintenance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_maintenance_issues_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "hostel_buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_maintenance_issues_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_rooms: {
        Row: {
          active: boolean
          amenities: string[] | null
          building_id: string
          capacity: number
          created_at: string
          current_occupancy: number
          floor_number: number
          gender_type: Database["public"]["Enums"]["gender_type"]
          id: string
          monthly_fee: number
          notes: string | null
          organization_id: string
          room_number: string
          room_type: Database["public"]["Enums"]["room_type"]
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          amenities?: string[] | null
          building_id: string
          capacity?: number
          created_at?: string
          current_occupancy?: number
          floor_number: number
          gender_type: Database["public"]["Enums"]["gender_type"]
          id?: string
          monthly_fee?: number
          notes?: string | null
          organization_id: string
          room_number: string
          room_type?: Database["public"]["Enums"]["room_type"]
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          amenities?: string[] | null
          building_id?: string
          capacity?: number
          created_at?: string
          current_occupancy?: number
          floor_number?: number
          gender_type?: Database["public"]["Enums"]["gender_type"]
          id?: string
          monthly_fee?: number
          notes?: string | null
          organization_id?: string
          room_number?: string
          room_type?: Database["public"]["Enums"]["room_type"]
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "hostel_buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_visitors: {
        Row: {
          approved_by: string | null
          building_id: string
          check_in_time: string
          check_out_time: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          purpose: string | null
          relationship: string | null
          status: string
          trainee_id: string
          visit_date: string
          visitor_id_number: string | null
          visitor_name: string
          visitor_phone: string | null
        }
        Insert: {
          approved_by?: string | null
          building_id: string
          check_in_time: string
          check_out_time?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          purpose?: string | null
          relationship?: string | null
          status?: string
          trainee_id: string
          visit_date?: string
          visitor_id_number?: string | null
          visitor_name: string
          visitor_phone?: string | null
        }
        Update: {
          approved_by?: string | null
          building_id?: string
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          purpose?: string | null
          relationship?: string | null
          status?: string
          trainee_id?: string
          visit_date?: string
          visitor_id_number?: string | null
          visitor_name?: string
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hostel_visitors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "hostel_buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_visitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_visitors_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_visitors_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_placements: {
        Row: {
          approved_by: string | null
          attachment_letter_path: string | null
          created_at: string
          employer_id: string | null
          end_date: string | null
          evaluation_remarks: string | null
          evaluation_score: number | null
          id: string
          organization_id: string
          placement_number: string
          start_date: string
          status: string
          supervisor_contact: string | null
          supervisor_name: string | null
          trainee_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          attachment_letter_path?: string | null
          created_at?: string
          employer_id?: string | null
          end_date?: string | null
          evaluation_remarks?: string | null
          evaluation_score?: number | null
          id?: string
          organization_id: string
          placement_number: string
          start_date: string
          status?: string
          supervisor_contact?: string | null
          supervisor_name?: string | null
          trainee_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          attachment_letter_path?: string | null
          created_at?: string
          employer_id?: string | null
          end_date?: string | null
          evaluation_remarks?: string | null
          evaluation_score?: number | null
          id?: string
          organization_id?: string
          placement_number?: string
          start_date?: string
          status?: string
          supervisor_contact?: string | null
          supervisor_name?: string | null
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_placements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_placements_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_placements_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total_price?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance: number | null
          created_at: string
          created_by: string
          due_date: string
          fee_record_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          organization_id: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          trainee_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance?: number | null
          created_at?: string
          created_by: string
          due_date: string
          fee_record_id?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          trainee_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance?: number | null
          created_at?: string
          created_by?: string
          due_date?: string
          fee_record_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          trainee_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_fee_record_id_fkey"
            columns: ["fee_record_id"]
            isOneToOne: false
            referencedRelation: "fee_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          application_date: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          organization_id: string
          remarks: string | null
          resume_path: string | null
          status: string
          trainee_id: string
          updated_at: string
        }
        Insert: {
          application_date?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          remarks?: string | null
          resume_path?: string | null
          status?: string
          trainee_id: string
          updated_at?: string
        }
        Update: {
          application_date?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          remarks?: string | null
          resume_path?: string | null
          status?: string
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          closing_date: string | null
          created_at: string
          description: string
          employer_id: string | null
          id: string
          location: string | null
          organization_id: string
          posted_by: string
          posted_date: string
          requirements: string | null
          salary_range: string | null
          status: string
          title: string
          trade_id: string | null
          updated_at: string
        }
        Insert: {
          closing_date?: string | null
          created_at?: string
          description: string
          employer_id?: string | null
          id?: string
          location?: string | null
          organization_id: string
          posted_by: string
          posted_date?: string
          requirements?: string | null
          salary_range?: string | null
          status?: string
          title: string
          trade_id?: string | null
          updated_at?: string
        }
        Update: {
          closing_date?: string | null
          created_at?: string
          description?: string
          employer_id?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          posted_by?: string
          posted_date?: string
          requirements?: string | null
          salary_range?: string | null
          status?: string
          title?: string
          trade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      library_borrowing: {
        Row: {
          borrow_date: string
          borrower_id: string
          borrower_type: string
          created_at: string
          due_date: string
          id: string
          issued_by: string
          library_item_id: string
          notes: string | null
          organization_id: string
          return_date: string | null
          returned_to: string | null
          status: Database["public"]["Enums"]["borrowing_status"]
          updated_at: string
        }
        Insert: {
          borrow_date?: string
          borrower_id: string
          borrower_type?: string
          created_at?: string
          due_date: string
          id?: string
          issued_by: string
          library_item_id: string
          notes?: string | null
          organization_id: string
          return_date?: string | null
          returned_to?: string | null
          status?: Database["public"]["Enums"]["borrowing_status"]
          updated_at?: string
        }
        Update: {
          borrow_date?: string
          borrower_id?: string
          borrower_type?: string
          created_at?: string
          due_date?: string
          id?: string
          issued_by?: string
          library_item_id?: string
          notes?: string | null
          organization_id?: string
          return_date?: string | null
          returned_to?: string | null
          status?: Database["public"]["Enums"]["borrowing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_borrowing_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      library_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_fines: {
        Row: {
          amount_paid: number
          balance: number | null
          borrower_id: string
          borrowing_id: string
          created_at: string
          days_overdue: number
          fine_amount: number
          id: string
          notes: string | null
          organization_id: string
          payment_date: string | null
          status: Database["public"]["Enums"]["fine_status"]
          updated_at: string
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          amount_paid?: number
          balance?: number | null
          borrower_id: string
          borrowing_id: string
          created_at?: string
          days_overdue?: number
          fine_amount?: number
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          status?: Database["public"]["Enums"]["fine_status"]
          updated_at?: string
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          amount_paid?: number
          balance?: number | null
          borrower_id?: string
          borrowing_id?: string
          created_at?: string
          days_overdue?: number
          fine_amount?: number
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          status?: Database["public"]["Enums"]["fine_status"]
          updated_at?: string
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_fines_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "library_borrowing"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          active: boolean
          author: string | null
          available_copies: number
          category_id: string | null
          created_at: string
          description: string | null
          digital_file_path: string | null
          digital_resource_url: string | null
          edition: string | null
          id: string
          isbn: string | null
          item_type: Database["public"]["Enums"]["library_item_type"]
          language: string | null
          location: string | null
          organization_id: string
          publication_year: number | null
          publisher: string | null
          subject: string | null
          title: string
          total_copies: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          author?: string | null
          available_copies?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          digital_file_path?: string | null
          digital_resource_url?: string | null
          edition?: string | null
          id?: string
          isbn?: string | null
          item_type?: Database["public"]["Enums"]["library_item_type"]
          language?: string | null
          location?: string | null
          organization_id: string
          publication_year?: number | null
          publisher?: string | null
          subject?: string | null
          title: string
          total_copies?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          author?: string | null
          available_copies?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          digital_file_path?: string | null
          digital_resource_url?: string | null
          edition?: string | null
          id?: string
          isbn?: string | null
          item_type?: Database["public"]["Enums"]["library_item_type"]
          language?: string | null
          location?: string | null
          organization_id?: string
          publication_year?: number | null
          publisher?: string | null
          subject?: string | null
          title?: string
          total_copies?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
        }
        Update: {
          created_at?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      maintenance_costs: {
        Row: {
          cost_type: string
          created_at: string
          description: string
          id: string
          invoice_number: string | null
          notes: string | null
          payment_status: string | null
          quantity: number | null
          supplier_id: string | null
          task_id: string
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          cost_type: string
          created_at?: string
          description: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string | null
          quantity?: number | null
          supplier_id?: string | null
          task_id: string
          total_cost: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          cost_type?: string
          created_at?: string
          description?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string | null
          quantity?: number | null
          supplier_id?: string | null
          task_id?: string
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_materials: {
        Row: {
          created_at: string
          id: string
          material_name: string
          notes: string | null
          quantity: number
          stock_item_id: string | null
          task_id: string
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          notes?: string | null
          quantity: number
          stock_item_id?: string | null
          task_id: string
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          notes?: string | null
          quantity?: number
          stock_item_id?: string | null
          task_id?: string
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_materials_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_materials_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          asset_id: string | null
          created_at: string
          description: string
          estimated_cost: number | null
          id: string
          location: string | null
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          organization_id: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason: string | null
          request_date: string
          request_number: string
          requested_by: string
          status: Database["public"]["Enums"]["maintenance_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          asset_id?: string | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          id?: string
          location?: string | null
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          organization_id: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason?: string | null
          request_date?: string
          request_number: string
          requested_by: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          asset_id?: string | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          id?: string
          location?: string | null
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          organization_id?: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason?: string | null
          request_date?: string
          request_number?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          active: boolean
          asset_id: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_cost: number | null
          estimated_duration_hours: number | null
          frequency_interval: number
          frequency_type: string
          id: string
          last_maintenance_date: string | null
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          next_maintenance_date: string
          organization_id: string
          schedule_number: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_cost?: number | null
          estimated_duration_hours?: number | null
          frequency_interval?: number
          frequency_type: string
          id?: string
          last_maintenance_date?: string | null
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          next_maintenance_date: string
          organization_id: string
          schedule_number: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_cost?: number | null
          estimated_duration_hours?: number | null
          frequency_interval?: number
          frequency_type?: string
          id?: string
          last_maintenance_date?: string | null
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          next_maintenance_date?: string
          organization_id?: string
          schedule_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          asset_id: string | null
          assigned_by: string
          assigned_date: string
          assigned_to: string | null
          completion_notes: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          request_id: string | null
          schedule_id: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          task_number: string
          title: string
          updated_at: string
          work_performed: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          asset_id?: string | null
          assigned_by: string
          assigned_date?: string
          assigned_to?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          request_id?: string | null
          schedule_id?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          task_number: string
          title: string
          updated_at?: string
          work_performed?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          asset_id?: string | null
          assigned_by?: string
          assigned_date?: string
          assigned_to?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          request_id?: string | null
          schedule_id?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          task_number?: string
          title?: string
          updated_at?: string
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          assessment_id: string
          id: string
          is_locked: boolean
          is_withheld: boolean
          locked_at: string | null
          locked_by: string | null
          marks_obtained: number | null
          remarks: string | null
          submitted_at: string
          submitted_by: string
          trainee_id: string
          updated_at: string
          withheld_at: string | null
          withheld_by: string | null
          withheld_reason: string | null
        }
        Insert: {
          assessment_id: string
          id?: string
          is_locked?: boolean
          is_withheld?: boolean
          locked_at?: string | null
          locked_by?: string | null
          marks_obtained?: number | null
          remarks?: string | null
          submitted_at?: string
          submitted_by: string
          trainee_id: string
          updated_at?: string
          withheld_at?: string | null
          withheld_by?: string | null
          withheld_reason?: string | null
        }
        Update: {
          assessment_id?: string
          id?: string
          is_locked?: boolean
          is_withheld?: boolean
          locked_at?: string | null
          locked_by?: string | null
          marks_obtained?: number | null
          remarks?: string | null
          submitted_at?: string
          submitted_by?: string
          trainee_id?: string
          updated_at?: string
          withheld_at?: string | null
          withheld_by?: string | null
          withheld_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          message: string
          organization_id: string | null
          read: boolean
          receiver_id: string
          sender_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          organization_id?: string | null
          read?: boolean
          receiver_id: string
          sender_id: string
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          organization_id?: string | null
          read?: boolean
          receiver_id?: string
          sender_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_completions: {
        Row: {
          completed_at: string | null
          feedback: string | null
          id: string
          module_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          feedback?: string | null
          id?: string
          module_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          feedback?: string | null
          id?: string
          module_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      namibia_regions: {
        Row: {
          active: boolean | null
          code: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          code: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          organization_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          organization_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          organization_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          completed_modules: string[] | null
          created_at: string | null
          current_step: number | null
          id: string
          onboarding_completed: boolean | null
          profile_completed: boolean | null
          training_completed: boolean | null
          training_started: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_modules?: string[] | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          onboarding_completed?: boolean | null
          profile_completed?: boolean | null
          training_completed?: boolean | null
          training_started?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_modules?: string[] | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          onboarding_completed?: boolean | null
          profile_completed?: boolean | null
          training_completed?: boolean | null
          training_started?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organization_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_packages: {
        Row: {
          auto_renew: boolean
          created_at: string
          end_date: string | null
          id: string
          is_trial: boolean
          organization_id: string
          package_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          is_trial?: boolean
          organization_id: string
          package_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          is_trial?: boolean
          organization_id?: string
          package_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          color_theme: Json | null
          created_at: string
          domain: string | null
          favicon: string | null
          id: string
          logo_url: string | null
          organization_id: string
          organization_name: string | null
          updated_at: string
        }
        Insert: {
          color_theme?: Json | null
          created_at?: string
          domain?: string | null
          favicon?: string | null
          id?: string
          logo_url?: string | null
          organization_id: string
          organization_name?: string | null
          updated_at?: string
        }
        Update: {
          color_theme?: Json | null
          created_at?: string
          domain?: string | null
          favicon?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string
          organization_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          created_at: string
          email_domain: string | null
          id: string
          name: string
          package: Database["public"]["Enums"]["package_type"]
          subdomain: string | null
          trainee_id_prefix: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email_domain?: string | null
          id?: string
          name: string
          package?: Database["public"]["Enums"]["package_type"]
          subdomain?: string | null
          trainee_id_prefix?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email_domain?: string | null
          id?: string
          name?: string
          package?: Database["public"]["Enums"]["package_type"]
          subdomain?: string | null
          trainee_id_prefix?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          active: boolean
          billing_cycle: string
          created_at: string
          description: string | null
          features: string[] | null
          id: string
          is_trial: boolean
          limits: Json
          module_access: Json
          name: string
          price: number
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_trial?: boolean
          limits?: Json
          module_access?: Json
          name: string
          price: number
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_trial?: boolean
          limits?: Json
          module_access?: Json
          name?: string
          price?: number
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      password_policies: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          lockout_attempts: number | null
          lockout_duration_minutes: number | null
          max_age_days: number | null
          min_length: number
          organization_id: string | null
          prevent_reuse_count: number | null
          require_lowercase: boolean | null
          require_numbers: boolean | null
          require_special_chars: boolean | null
          require_uppercase: boolean | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          lockout_attempts?: number | null
          lockout_duration_minutes?: number | null
          max_age_days?: number | null
          min_length?: number
          organization_id?: string | null
          prevent_reuse_count?: number | null
          require_lowercase?: boolean | null
          require_numbers?: boolean | null
          require_special_chars?: boolean | null
          require_uppercase?: boolean | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          lockout_attempts?: number | null
          lockout_duration_minutes?: number | null
          max_age_days?: number | null
          min_length?: number
          organization_id?: string | null
          prevent_reuse_count?: number | null
          require_lowercase?: boolean | null
          require_numbers?: boolean | null
          require_special_chars?: boolean | null
          require_uppercase?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_clearances: {
        Row: {
          amount_paid: number
          amount_required: number
          application_id: string | null
          balance: number | null
          clearance_type: string
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          fee_type: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          requested_at: string | null
          requested_by: string | null
          source_dashboard: string | null
          status: string
          trainee_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          amount_required?: number
          application_id?: string | null
          balance?: number | null
          clearance_type?: string
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          fee_type?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          requested_at?: string | null
          requested_by?: string | null
          source_dashboard?: string | null
          status?: string
          trainee_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          amount_required?: number
          application_id?: string | null
          balance?: number | null
          clearance_type?: string
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          fee_type?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          requested_at?: string | null
          requested_by?: string | null
          source_dashboard?: string | null
          status?: string
          trainee_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_clearances_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "trainee_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_clearances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_clearances_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_clearances_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          paid_amount: number | null
          paid_date: string | null
          payment_id: string | null
          payment_plan_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          paid_amount?: number | null
          paid_date?: string | null
          payment_id?: string | null
          payment_plan_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_amount?: number | null
          paid_date?: string | null
          payment_id?: string | null
          payment_plan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          created_by: string
          end_date: string | null
          fee_record_id: string
          id: string
          installment_amount: number
          installments: number
          notes: string | null
          organization_id: string
          plan_name: string
          start_date: string
          status: string
          total_amount: number
          trainee_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date?: string | null
          fee_record_id: string
          id?: string
          installment_amount: number
          installments?: number
          notes?: string | null
          organization_id: string
          plan_name: string
          start_date: string
          status?: string
          total_amount: number
          trainee_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string | null
          fee_record_id?: string
          id?: string
          installment_amount?: number
          installments?: number
          notes?: string | null
          organization_id?: string
          plan_name?: string
          start_date?: string
          status?: string
          total_amount?: number
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_fee_record_id_fkey"
            columns: ["fee_record_id"]
            isOneToOne: false
            referencedRelation: "fee_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          fee_record_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          recorded_by: string
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fee_record_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fee_record_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_fee_record_id_fkey"
            columns: ["fee_record_id"]
            isOneToOne: false
            referencedRelation: "fee_records"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_logs: {
        Row: {
          action: string
          changed_by: string
          created_at: string
          id: string
          module_code: string | null
          new_permissions: Json | null
          old_permissions: Json | null
          organization_id: string | null
          reason: string | null
          role_code: string | null
          user_id: string
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string
          id?: string
          module_code?: string | null
          new_permissions?: Json | null
          old_permissions?: Json | null
          organization_id?: string | null
          reason?: string | null
          role_code?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string
          id?: string
          module_code?: string | null
          new_permissions?: Json | null
          old_permissions?: Json | null
          organization_id?: string | null
          reason?: string | null
          role_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          firstname: string | null
          full_name: string
          id: string
          phone: string | null
          surname: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          firstname?: string | null
          full_name: string
          id?: string
          phone?: string | null
          surname?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          firstname?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          surname?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progression_rules: {
        Row: {
          active: boolean | null
          created_at: string
          from_level: number
          id: string
          max_outstanding_fees: number | null
          min_attendance_percentage: number | null
          min_competencies_required: number | null
          min_credits_required: number
          organization_id: string
          to_level: number
          trade_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          from_level: number
          id?: string
          max_outstanding_fees?: number | null
          min_attendance_percentage?: number | null
          min_competencies_required?: number | null
          min_credits_required: number
          organization_id: string
          to_level: number
          trade_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          from_level?: number
          id?: string
          max_outstanding_fees?: number | null
          min_attendance_percentage?: number | null
          min_competencies_required?: number | null
          min_credits_required?: number
          organization_id?: string
          to_level?: number
          trade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progression_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progression_rules_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_of_registrations: {
        Row: {
          academic_year: string
          created_at: string
          file_path: string | null
          generated_at: string
          generated_by: string
          id: string
          organization_id: string
          qualification_id: string
          reference_number: string
          registration_date: string
          trainee_id: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          file_path?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          organization_id: string
          qualification_id: string
          reference_number: string
          registration_date?: string
          trainee_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          file_path?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          organization_id?: string
          qualification_id?: string
          reference_number?: string
          registration_date?: string
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_registrations_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_registrations_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_registrations_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      provisioning_logs: {
        Row: {
          application_id: string | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          result: string
          trainee_id: string | null
          trigger_type: string
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          result: string
          trainee_id?: string | null
          trigger_type: string
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          result?: string
          trainee_id?: string | null
          trigger_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "trainee_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_logs_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_logs_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          item_description: string
          notes: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          stock_item_id: string | null
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_description: string
          notes?: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          stock_item_id?: string | null
          total_cost?: number | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          item_description?: string
          notes?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          stock_item_id?: string | null
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string
          expected_delivery_date: string | null
          grand_total: number
          id: string
          notes: string | null
          order_date: string
          organization_id: string
          po_number: string
          requisition_id: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expected_delivery_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          organization_id: string
          po_number: string
          requisition_id?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expected_delivery_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          organization_id?: string
          po_number?: string
          requisition_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisition_items: {
        Row: {
          created_at: string
          estimated_unit_cost: number
          id: string
          item_description: string
          quantity: number
          requisition_id: string
          stock_item_id: string | null
          total_estimated_cost: number | null
        }
        Insert: {
          created_at?: string
          estimated_unit_cost: number
          id?: string
          item_description: string
          quantity: number
          requisition_id: string
          stock_item_id?: string | null
          total_estimated_cost?: number | null
        }
        Update: {
          created_at?: string
          estimated_unit_cost?: number
          id?: string
          item_description?: string
          quantity?: number
          requisition_id?: string
          stock_item_id?: string | null
          total_estimated_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisition_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          created_at: string
          department: string | null
          id: string
          justification: string | null
          organization_id: string
          rejected_reason: string | null
          requested_by: string
          requested_date: string
          requisition_number: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string
          department?: string | null
          id?: string
          justification?: string | null
          organization_id: string
          rejected_reason?: string | null
          requested_by: string
          requested_date?: string
          requisition_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string
          department?: string | null
          id?: string
          justification?: string | null
          organization_id?: string
          rejected_reason?: string | null
          requested_by?: string
          requested_date?: string
          requisition_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qualification_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          comments: string | null
          created_at: string
          id: string
          performed_by: string
          qualification_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          comments?: string | null
          created_at?: string
          id?: string
          performed_by: string
          qualification_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          comments?: string | null
          created_at?: string
          id?: string
          performed_by?: string
          qualification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_approvals_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_unit_standards: {
        Row: {
          created_at: string
          credit_value: number | null
          id: string
          is_mandatory: boolean
          level: number
          qualification_id: string
          unit_standard_id: string
          unit_standard_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_value?: number | null
          id?: string
          is_mandatory?: boolean
          level: number
          qualification_id: string
          unit_standard_id: string
          unit_standard_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_value?: number | null
          id?: string
          is_mandatory?: boolean
          level?: number
          qualification_id?: string
          unit_standard_id?: string
          unit_standard_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_unit_standards_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifications: {
        Row: {
          active: boolean
          approval_date: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          id: string
          nqf_level: number
          organization_id: string
          qualification_code: string
          qualification_title: string
          qualification_type: Database["public"]["Enums"]["qualification_type"]
          rejection_comments: string | null
          status: Database["public"]["Enums"]["qualification_status"]
          trade_id: string | null
          updated_at: string
          version_number: number
        }
        Insert: {
          active?: boolean
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          id?: string
          nqf_level: number
          organization_id: string
          qualification_code: string
          qualification_title: string
          qualification_type: Database["public"]["Enums"]["qualification_type"]
          rejection_comments?: string | null
          status?: Database["public"]["Enums"]["qualification_status"]
          trade_id?: string | null
          updated_at?: string
          version_number?: number
        }
        Update: {
          active?: boolean
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value?: number
          id?: string
          nqf_level?: number
          organization_id?: string
          qualification_code?: string
          qualification_title?: string
          qualification_type?: Database["public"]["Enums"]["qualification_type"]
          rejection_comments?: string | null
          status?: Database["public"]["Enums"]["qualification_status"]
          trade_id?: string | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifications_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_report_items: {
        Row: {
          condition_notes: string | null
          created_at: string
          id: string
          po_item_id: string
          quantity_accepted: number
          quantity_received: number
          quantity_rejected: number
          receiving_report_id: string
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string
          id?: string
          po_item_id: string
          quantity_accepted: number
          quantity_received: number
          quantity_rejected?: number
          receiving_report_id: string
        }
        Update: {
          condition_notes?: string | null
          created_at?: string
          id?: string
          po_item_id?: string
          quantity_accepted?: number
          quantity_received?: number
          quantity_rejected?: number
          receiving_report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_report_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_report_items_receiving_report_id_fkey"
            columns: ["receiving_report_id"]
            isOneToOne: false
            referencedRelation: "receiving_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_reports: {
        Row: {
          created_at: string
          id: string
          inspection_status: string
          inspector_notes: string | null
          organization_id: string
          purchase_order_id: string
          receipt_number: string
          received_by: string
          received_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_status?: string
          inspector_notes?: string | null
          organization_id: string
          purchase_order_id: string
          receipt_number: string
          received_by: string
          received_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_status?: string
          inspector_notes?: string | null
          organization_id?: string
          purchase_order_id?: string
          receipt_number?: string
          received_by?: string
          received_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_reports_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          academic_year: string
          application_id: string | null
          created_at: string
          hostel_required: boolean | null
          id: string
          organization_id: string
          qualification_id: string | null
          registered_at: string | null
          registered_by: string | null
          registration_status: string
          trainee_id: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          application_id?: string | null
          created_at?: string
          hostel_required?: boolean | null
          id?: string
          organization_id: string
          qualification_id?: string | null
          registered_at?: string | null
          registered_by?: string | null
          registration_status?: string
          trainee_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          application_id?: string | null
          created_at?: string
          hostel_required?: boolean | null
          id?: string
          organization_id?: string
          qualification_id?: string | null
          registered_at?: string | null
          registered_by?: string | null
          registration_status?: string
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "trainee_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_change_requests: {
        Row: {
          created_at: string
          entry_requirement_id: string | null
          id: string
          organization_id: string
          proposed_changes: Json
          request_type: string
          requested_at: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entry_requirement_id?: string | null
          id?: string
          organization_id: string
          proposed_changes: Json
          request_type: string
          requested_at?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entry_requirement_id?: string | null
          id?: string
          organization_id?: string
          proposed_changes?: Json
          request_type?: string
          requested_at?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_change_requests_entry_requirement_id_fkey"
            columns: ["entry_requirement_id"]
            isOneToOne: false
            referencedRelation: "entry_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      role_activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          module_code: string
          page_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module_code: string
          page_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module_code?: string
          page_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_code: string
          role_code: string
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_code: string
          role_code: string
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_code?: string
          role_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_inspections: {
        Row: {
          cleanliness_rating: number | null
          condition_rating: number | null
          created_at: string
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          inspection_date: string
          inspector_id: string
          issues_found: string | null
          organization_id: string
          overall_rating: number | null
          recommendations: string | null
          room_id: string
          safety_rating: number | null
          status: string
        }
        Insert: {
          cleanliness_rating?: number | null
          condition_rating?: number | null
          created_at?: string
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          inspection_date?: string
          inspector_id: string
          issues_found?: string | null
          organization_id: string
          overall_rating?: number | null
          recommendations?: string | null
          room_id: string
          safety_rating?: number | null
          status?: string
        }
        Update: {
          cleanliness_rating?: number | null
          condition_rating?: number | null
          created_at?: string
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          inspection_date?: string
          inspector_id?: string
          issues_found?: string | null
          organization_id?: string
          overall_rating?: number | null
          recommendations?: string | null
          room_id?: string
          safety_rating?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_inspections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          current_quantity: number
          id: string
          organization_id: string
          status: string
          stock_item_id: string
          threshold_quantity: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          current_quantity: number
          id?: string
          organization_id: string
          status?: string
          stock_item_id: string
          threshold_quantity: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          current_quantity?: number
          id?: string
          organization_id?: string
          status?: string
          stock_item_id?: string
          threshold_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          current_quantity: number
          description: string | null
          id: string
          item_code: string
          item_name: string
          location: string | null
          organization_id: string
          reorder_level: number
          unit_cost: number
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          current_quantity?: number
          description?: string | null
          id?: string
          item_code: string
          item_name: string
          location?: string | null
          organization_id: string
          reorder_level?: number
          unit_cost?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          current_quantity?: number
          description?: string | null
          id?: string
          item_code?: string
          item_name?: string
          location?: string | null
          organization_id?: string
          reorder_level?: number
          unit_cost?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          department: string | null
          id: string
          issued_by: string | null
          issued_to: string | null
          movement_date: string
          movement_type: string
          notes: string | null
          organization_id: string
          quantity: number
          reference_number: string | null
          stock_item_id: string
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          department?: string | null
          id?: string
          issued_by?: string | null
          issued_to?: string | null
          movement_date?: string
          movement_type: string
          notes?: string | null
          organization_id: string
          quantity: number
          reference_number?: string | null
          stock_item_id: string
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          department?: string | null
          id?: string
          issued_by?: string | null
          issued_to?: string | null
          movement_date?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          reference_number?: string | null
          stock_item_id?: string
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_issued_to_fkey"
            columns: ["issued_to"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_audit_logs: {
        Row: {
          action: string
          affected_record_id: string | null
          affected_table: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          super_admin_id: string
          target_organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          affected_record_id?: string | null
          affected_table?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          super_admin_id: string
          target_organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          affected_record_id?: string | null
          affected_table?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          super_admin_id?: string
          target_organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      supplier_performance: {
        Row: {
          communication_rating: number | null
          created_at: string
          delivery_rating: number | null
          evaluated_by: string
          evaluation_date: string
          id: string
          notes: string | null
          organization_id: string
          overall_rating: number | null
          price_rating: number | null
          quality_rating: number | null
          supplier_id: string
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string
          delivery_rating?: number | null
          evaluated_by: string
          evaluation_date?: string
          id?: string
          notes?: string | null
          organization_id: string
          overall_rating?: number | null
          price_rating?: number | null
          quality_rating?: number | null
          supplier_id: string
        }
        Update: {
          communication_rating?: number | null
          created_at?: string
          delivery_rating?: number | null
          evaluated_by?: string
          evaluation_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          overall_rating?: number | null
          price_rating?: number | null
          quality_rating?: number | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_performance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          payment_terms: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          payment_terms?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          payment_terms?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          organization_id: string
          priority: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          organization_id: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      symbol_points: {
        Row: {
          active: boolean | null
          created_at: string
          exam_level: string
          id: string
          organization_id: string
          points: number
          symbol: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          exam_level: string
          id?: string
          organization_id: string
          points: number
          symbol: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          exam_level?: string
          id?: string
          organization_id?: string
          points?: number
          symbol?: string
        }
        Relationships: []
      }
      system_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configuration: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          is_global: boolean | null
          organization_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean | null
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean | null
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_configuration_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          academic_year: string
          active: boolean | null
          class_id: string
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room_number: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          active?: boolean | null
          class_id: string
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room_number?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          active?: boolean | null
          class_id?: string
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room_number?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_levels: {
        Row: {
          active: boolean | null
          capacity: number | null
          created_at: string
          id: string
          level: number
          organization_id: string
          trade_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          capacity?: number | null
          created_at?: string
          id?: string
          level: number
          organization_id: string
          trade_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          capacity?: number | null
          created_at?: string
          id?: string
          level?: number
          organization_id?: string
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_levels_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_applications: {
        Row: {
          academic_qualifications_path: string | null
          academic_year: string
          account_provisioning_status:
            | Database["public"]["Enums"]["account_provisioning_status"]
            | null
          additional_documents_paths: Json | null
          address: string
          admission_letter_path: string | null
          application_number: string
          auto_qualification_result: Json | null
          calculated_points: number | null
          chef_jacket_size: string | null
          chef_trouser_size: string | null
          chronic_diseases_description: string | null
          created_at: string
          created_by: string
          date_of_birth: string
          declaration_accepted: boolean | null
          declaration_accepted_at: string | null
          disability_description: string | null
          email: string | null
          emergency_contact_email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_region: string | null
          emergency_contact_relationship: string | null
          emergency_contact_town: string | null
          employer_address: string | null
          employer_duration: string | null
          employer_email: string | null
          employer_fax: string | null
          employer_name: string | null
          employer_phone: string | null
          employer_position: string | null
          employer_region: string | null
          employer_town: string | null
          first_name: string
          gender: string
          has_chronic_diseases: boolean | null
          has_disability: boolean | null
          has_special_needs: boolean | null
          highest_grade_passed: number | null
          hostel_allocated: boolean | null
          hostel_application_data: Json | null
          hostel_application_status: string | null
          ict_access: Json | null
          id: string
          id_document_path: string | null
          intake: string
          is_mature_age_entry: boolean | null
          last_name: string
          marital_status: string | null
          national_id: string
          nationality: string | null
          needs_financial_assistance: boolean | null
          needs_hostel_accommodation: boolean | null
          organization_id: string
          overall_size: string | null
          payment_clearance_status: string | null
          payment_cleared_at: string | null
          payment_cleared_by: string | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          phone: string
          photo_path: string | null
          postal_address: string | null
          preferred_level: number
          preferred_training_mode: string
          proof_of_registration_path: string | null
          provisional_letter_path: string | null
          qualification_reasons: Json | null
          qualification_remarks: string | null
          qualification_status: string
          region: string | null
          registered_at: string | null
          registration_status: string
          school_leaving_cert_path: string | null
          school_subjects: Json | null
          screened_at: string | null
          screened_by: string | null
          shoe_size: string | null
          skirt_trousers_size: string | null
          special_needs_description: string | null
          system_email: string | null
          tertiary_address: string | null
          tertiary_exam_year: number | null
          tertiary_fax: string | null
          tertiary_institution: string | null
          tertiary_phone: string | null
          tertiary_region: string | null
          title: string | null
          trade_id: string
          trade_id_choice2: string | null
          trainee_number: string | null
          tshirt_size: string | null
          updated_at: string
          user_account_created: boolean | null
          user_id: string | null
        }
        Insert: {
          academic_qualifications_path?: string | null
          academic_year: string
          account_provisioning_status?:
            | Database["public"]["Enums"]["account_provisioning_status"]
            | null
          additional_documents_paths?: Json | null
          address: string
          admission_letter_path?: string | null
          application_number: string
          auto_qualification_result?: Json | null
          calculated_points?: number | null
          chef_jacket_size?: string | null
          chef_trouser_size?: string | null
          chronic_diseases_description?: string | null
          created_at?: string
          created_by: string
          date_of_birth: string
          declaration_accepted?: boolean | null
          declaration_accepted_at?: string | null
          disability_description?: string | null
          email?: string | null
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_region?: string | null
          emergency_contact_relationship?: string | null
          emergency_contact_town?: string | null
          employer_address?: string | null
          employer_duration?: string | null
          employer_email?: string | null
          employer_fax?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          employer_position?: string | null
          employer_region?: string | null
          employer_town?: string | null
          first_name: string
          gender: string
          has_chronic_diseases?: boolean | null
          has_disability?: boolean | null
          has_special_needs?: boolean | null
          highest_grade_passed?: number | null
          hostel_allocated?: boolean | null
          hostel_application_data?: Json | null
          hostel_application_status?: string | null
          ict_access?: Json | null
          id?: string
          id_document_path?: string | null
          intake: string
          is_mature_age_entry?: boolean | null
          last_name: string
          marital_status?: string | null
          national_id: string
          nationality?: string | null
          needs_financial_assistance?: boolean | null
          needs_hostel_accommodation?: boolean | null
          organization_id: string
          overall_size?: string | null
          payment_clearance_status?: string | null
          payment_cleared_at?: string | null
          payment_cleared_by?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          phone: string
          photo_path?: string | null
          postal_address?: string | null
          preferred_level?: number
          preferred_training_mode: string
          proof_of_registration_path?: string | null
          provisional_letter_path?: string | null
          qualification_reasons?: Json | null
          qualification_remarks?: string | null
          qualification_status?: string
          region?: string | null
          registered_at?: string | null
          registration_status?: string
          school_leaving_cert_path?: string | null
          school_subjects?: Json | null
          screened_at?: string | null
          screened_by?: string | null
          shoe_size?: string | null
          skirt_trousers_size?: string | null
          special_needs_description?: string | null
          system_email?: string | null
          tertiary_address?: string | null
          tertiary_exam_year?: number | null
          tertiary_fax?: string | null
          tertiary_institution?: string | null
          tertiary_phone?: string | null
          tertiary_region?: string | null
          title?: string | null
          trade_id: string
          trade_id_choice2?: string | null
          trainee_number?: string | null
          tshirt_size?: string | null
          updated_at?: string
          user_account_created?: boolean | null
          user_id?: string | null
        }
        Update: {
          academic_qualifications_path?: string | null
          academic_year?: string
          account_provisioning_status?:
            | Database["public"]["Enums"]["account_provisioning_status"]
            | null
          additional_documents_paths?: Json | null
          address?: string
          admission_letter_path?: string | null
          application_number?: string
          auto_qualification_result?: Json | null
          calculated_points?: number | null
          chef_jacket_size?: string | null
          chef_trouser_size?: string | null
          chronic_diseases_description?: string | null
          created_at?: string
          created_by?: string
          date_of_birth?: string
          declaration_accepted?: boolean | null
          declaration_accepted_at?: string | null
          disability_description?: string | null
          email?: string | null
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_region?: string | null
          emergency_contact_relationship?: string | null
          emergency_contact_town?: string | null
          employer_address?: string | null
          employer_duration?: string | null
          employer_email?: string | null
          employer_fax?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          employer_position?: string | null
          employer_region?: string | null
          employer_town?: string | null
          first_name?: string
          gender?: string
          has_chronic_diseases?: boolean | null
          has_disability?: boolean | null
          has_special_needs?: boolean | null
          highest_grade_passed?: number | null
          hostel_allocated?: boolean | null
          hostel_application_data?: Json | null
          hostel_application_status?: string | null
          ict_access?: Json | null
          id?: string
          id_document_path?: string | null
          intake?: string
          is_mature_age_entry?: boolean | null
          last_name?: string
          marital_status?: string | null
          national_id?: string
          nationality?: string | null
          needs_financial_assistance?: boolean | null
          needs_hostel_accommodation?: boolean | null
          organization_id?: string
          overall_size?: string | null
          payment_clearance_status?: string | null
          payment_cleared_at?: string | null
          payment_cleared_by?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          phone?: string
          photo_path?: string | null
          postal_address?: string | null
          preferred_level?: number
          preferred_training_mode?: string
          proof_of_registration_path?: string | null
          provisional_letter_path?: string | null
          qualification_reasons?: Json | null
          qualification_remarks?: string | null
          qualification_status?: string
          region?: string | null
          registered_at?: string | null
          registration_status?: string
          school_leaving_cert_path?: string | null
          school_subjects?: Json | null
          screened_at?: string | null
          screened_by?: string | null
          shoe_size?: string | null
          skirt_trousers_size?: string | null
          special_needs_description?: string | null
          system_email?: string | null
          tertiary_address?: string | null
          tertiary_exam_year?: number | null
          tertiary_fax?: string | null
          tertiary_institution?: string | null
          tertiary_phone?: string | null
          tertiary_region?: string | null
          title?: string | null
          trade_id?: string
          trade_id_choice2?: string | null
          trainee_number?: string | null
          tshirt_size?: string | null
          updated_at?: string
          user_account_created?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainee_applications_trade_id_choice2_fkey"
            columns: ["trade_id_choice2"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_applications_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_enrollments: {
        Row: {
          academic_year: string
          course_id: string
          created_at: string
          enrollment_date: string
          id: string
          status: string
          trainee_id: string
        }
        Insert: {
          academic_year: string
          course_id: string
          created_at?: string
          enrollment_date?: string
          id?: string
          status?: string
          trainee_id: string
        }
        Update: {
          academic_year?: string
          course_id?: string
          created_at?: string
          enrollment_date?: string
          id?: string
          status?: string
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_enrollments_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_enrollments_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_financial_accounts: {
        Row: {
          account_number: string
          application_id: string | null
          balance: number | null
          created_at: string
          id: string
          organization_id: string
          status: string
          total_fees: number
          total_paid: number
          trainee_id: string | null
          updated_at: string
        }
        Insert: {
          account_number: string
          application_id?: string | null
          balance?: number | null
          created_at?: string
          id?: string
          organization_id: string
          status?: string
          total_fees?: number
          total_paid?: number
          trainee_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string
          application_id?: string | null
          balance?: number | null
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          total_fees?: number
          total_paid?: number
          trainee_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_financial_accounts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "trainee_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_financial_accounts_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_financial_accounts_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_update_requests: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approver_id: string | null
          created_at: string
          id: string
          new_values: Json
          old_values: Json
          request_type: string
          requested_by: string
          status: string
          trainee_id: string
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          id?: string
          new_values: Json
          old_values: Json
          request_type: string
          requested_by: string
          status?: string
          trainee_id: string
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json
          old_values?: Json
          request_type?: string
          requested_by?: string
          status?: string
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_update_requests_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_update_requests_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      trainees: {
        Row: {
          academic_year: string
          account_provisioning_status:
            | Database["public"]["Enums"]["account_provisioning_status"]
            | null
          address: string
          archive_notes: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          date_of_birth: string
          email: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          has_pending_update: boolean | null
          id: string
          is_email_system_generated: boolean | null
          last_name: string
          level: number
          national_id: string
          organization_id: string | null
          password_reset_required: boolean | null
          phone: string
          qualification_id: string | null
          status: Database["public"]["Enums"]["trainee_status"]
          system_email: string | null
          trade_id: string
          trainee_id: string
          training_mode: Database["public"]["Enums"]["training_mode"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          academic_year: string
          account_provisioning_status?:
            | Database["public"]["Enums"]["account_provisioning_status"]
            | null
          address: string
          archive_notes?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          date_of_birth: string
          email?: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          has_pending_update?: boolean | null
          id?: string
          is_email_system_generated?: boolean | null
          last_name: string
          level: number
          national_id: string
          organization_id?: string | null
          password_reset_required?: boolean | null
          phone: string
          qualification_id?: string | null
          status?: Database["public"]["Enums"]["trainee_status"]
          system_email?: string | null
          trade_id: string
          trainee_id: string
          training_mode: Database["public"]["Enums"]["training_mode"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          academic_year?: string
          account_provisioning_status?:
            | Database["public"]["Enums"]["account_provisioning_status"]
            | null
          address?: string
          archive_notes?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          date_of_birth?: string
          email?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          has_pending_update?: boolean | null
          id?: string
          is_email_system_generated?: boolean | null
          last_name?: string
          level?: number
          national_id?: string
          organization_id?: string | null
          password_reset_required?: boolean | null
          phone?: string
          qualification_id?: string | null
          status?: Database["public"]["Enums"]["trainee_status"]
          system_email?: string | null
          trade_id?: string
          trainee_id?: string
          training_mode?: Database["public"]["Enums"]["training_mode"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainees_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainees_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_trades: {
        Row: {
          created_at: string
          id: string
          trade_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          trade_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          trade_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_trades_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_trades_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          active: boolean
          created_at: string
          designation: string | null
          email: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          organization_id: string | null
          phone: string | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          designation?: string | null
          email?: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          organization_id?: string | null
          phone?: string | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          designation?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          organization_id?: string | null
          phone?: string | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          content: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_required: boolean | null
          order_index: number
          role_specific: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_required?: boolean | null
          order_index?: number
          role_specific?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_required?: boolean | null
          order_index?: number
          role_specific?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          academic_year: string
          approved_at: string | null
          approved_by: string | null
          completed_credits: number | null
          created_at: string
          file_path: string | null
          generated_by: string
          gpa: number | null
          id: string
          issue_date: string
          organization_id: string
          status: string
          total_credits: number | null
          trainee_id: string
          transcript_number: string
        }
        Insert: {
          academic_year: string
          approved_at?: string | null
          approved_by?: string | null
          completed_credits?: number | null
          created_at?: string
          file_path?: string | null
          generated_by: string
          gpa?: number | null
          id?: string
          issue_date?: string
          organization_id: string
          status?: string
          total_credits?: number | null
          trainee_id: string
          transcript_number: string
        }
        Update: {
          academic_year?: string
          approved_at?: string | null
          approved_by?: string | null
          completed_credits?: number | null
          created_at?: string
          file_path?: string | null
          generated_by?: string
          gpa?: number | null
          id?: string
          issue_date?: string
          organization_id?: string
          status?: string
          total_credits?: number | null
          trainee_id?: string
          transcript_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainee_login_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_standards: {
        Row: {
          active: boolean
          created_at: string
          credit: number
          id: string
          level: number
          module_title: string
          unit_no: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credit: number
          id?: string
          level: number
          module_title: string
          unit_no: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credit?: number
          id?: string
          level?: number
          module_title?: string
          unit_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          module_code: string | null
          organization_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module_code?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module_code?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      attendance_analytics: {
        Row: {
          academic_year: string | null
          attendance_percentage: number | null
          level: number | null
          organization_id: string | null
          present_count: number | null
          register_id: string | null
          total_records: number | null
          trade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "attendance_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_registers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_registers_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      role_activity_summary: {
        Row: {
          activity_count: number | null
          last_activity: string | null
          module_code: string | null
          role: string | null
          unique_users: number | null
        }
        Relationships: []
      }
      trainee_login_info: {
        Row: {
          email_domain: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          organization_id: string | null
          organization_name: string | null
          password_reset_required: boolean | null
          system_email: string | null
          trainee_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_application_points: {
        Args: { _org_id: string; _school_subjects: Json }
        Returns: number
      }
      calculate_trainee_gpa: { Args: { _trainee_id: string }; Returns: number }
      can_approve_qualifications: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_manage_qualifications: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_trainee_enroll: {
        Args: {
          _trainee_id: string
          _training_mode: Database["public"]["Enums"]["training_mode"]
        }
        Returns: boolean
      }
      check_organization_limit: {
        Args: { _current_count: number; _limit_type: string; _org_id: string }
        Returns: boolean
      }
      check_subscription_expiry: {
        Args: never
        Returns: {
          days_remaining: number
          organization_id: string
          organization_name: string
          package_name: string
          status: string
        }[]
      }
      check_trainee_progression: {
        Args: { _trainee_id: string }
        Returns: {
          attendance_percentage: number
          attendance_required: number
          can_progress: boolean
          credits_completed: number
          credits_required: number
          current_level: number
          max_fees_allowed: number
          next_level: number
          outstanding_fees: number
          reasons: string[]
        }[]
      }
      clear_payment: {
        Args: {
          _amount: number
          _clearance_id: string
          _notes?: string
          _payment_method: string
        }
        Returns: boolean
      }
      expire_trial_packages: {
        Args: never
        Returns: {
          expired_at: string
          organization_id: string
          package_name: string
        }[]
      }
      generate_application_number: { Args: never; Returns: string }
      generate_continuous_trainee_number:
        | { Args: never; Returns: string }
        | { Args: { org_id: string }; Returns: string }
      generate_invoice_number: { Args: { _org_id: string }; Returns: string }
      generate_por_reference: { Args: { _org_id: string }; Returns: string }
      generate_trainee_id:
        | { Args: never; Returns: string }
        | { Args: { org_id: string }; Returns: string }
      generate_trainee_system_email: {
        Args: { p_org_id: string; p_trainee_number: string }
        Returns: string
      }
      generate_transcript_number: { Args: { _org_id: string }; Returns: string }
      get_applications_needing_provisioning: {
        Args: { _org_id: string }
        Returns: {
          account_provisioning_status: Database["public"]["Enums"]["account_provisioning_status"]
          application_id: string
          first_name: string
          last_name: string
          qualification_status: string
          registration_status: string
          system_email: string
          trainee_number: string
        }[]
      }
      get_asset_categories_count: {
        Args: { _org_id?: string }
        Returns: number
      }
      get_organization_active_package: {
        Args: { _org_id: string }
        Returns: {
          end_date: string
          is_trial: boolean
          limits: Json
          module_access: Json
          package_id: string
          package_name: string
          status: string
        }[]
      }
      get_pending_clearance_count: {
        Args: { _org_id: string }
        Returns: number
      }
      get_system_stats: { Args: never; Returns: Json }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      global_search: {
        Args: { org_id?: string; search_limit?: number; search_query: string }
        Returns: {
          relevance: number
          result_data: Json
          result_id: string
          result_type: string
        }[]
      }
      has_custom_permission: {
        Args: {
          _module_code: string
          _permission_type?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_module_access: {
        Args: { _module_code: string; _org_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_organization_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _new_data?: Json
          _old_data?: Json
          _record_id?: string
          _table_name?: string
        }
        Returns: string
      }
      log_permission_change: {
        Args: {
          _action: string
          _module_code?: string
          _new_permissions?: Json
          _old_permissions?: Json
          _reason?: string
          _role_code?: string
          _user_id: string
        }
        Returns: string
      }
      log_provisioning_attempt: {
        Args: {
          _application_id: string
          _email: string
          _error_message?: string
          _metadata?: Json
          _org_id: string
          _result: string
          _trainee_id: string
          _trigger_type: string
          _user_id: string
        }
        Returns: string
      }
      log_super_admin_action: {
        Args: {
          _action: string
          _affected_record_id?: string
          _affected_table?: string
          _new_data?: Json
          _old_data?: Json
          _target_org_id?: string
        }
        Returns: string
      }
      organization_has_module: {
        Args: { _module_code: string; _org_id: string }
        Returns: boolean
      }
      seed_symbol_points_for_organization: {
        Args: { org_id: string }
        Returns: undefined
      }
      trainee_has_outstanding_fees: {
        Args: { _academic_year: string; _trainee_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_provisioning_status:
        | "not_started"
        | "auto_provisioned"
        | "manually_provisioned"
        | "failed"
      allocation_status: "active" | "checked_out" | "pending" | "cancelled"
      app_role:
        | "admin"
        | "registration_officer"
        | "debtor_officer"
        | "trainer"
        | "hod"
        | "viewer"
        | "assessment_coordinator"
        | "super_admin"
        | "organization_admin"
        | "stock_control_officer"
        | "asset_maintenance_coordinator"
        | "procurement_officer"
        | "maintenance_coordinator"
        | "librarian"
        | "hostel_coordinator"
        | "placement_officer"
        | "trainee"
        | "vms_developer"
        | "vms_support"
        | "head_of_training"
        | "head_of_trainee_support"
        | "liaison_officer"
        | "resource_center_coordinator"
        | "projects_coordinator"
        | "hr_officer"
        | "bdl_coordinator"
        | "rpl_coordinator"
        | "head_trainee_support"
      approval_action: "submitted" | "approved" | "rejected" | "returned"
      asset_condition: "excellent" | "good" | "fair" | "poor" | "needs_repair"
      asset_status:
        | "active"
        | "under_repair"
        | "disposed"
        | "in_storage"
        | "retired"
      bed_status: "available" | "occupied" | "reserved" | "maintenance"
      borrowing_status: "borrowed" | "returned" | "overdue"
      duration_unit: "months" | "years"
      employment_type: "fulltime" | "parttime" | "contract"
      fine_status: "pending" | "paid" | "waived"
      gender: "male" | "female" | "other"
      gender_type: "male" | "female" | "mixed"
      hostel_maintenance_status:
        | "reported"
        | "in_progress"
        | "completed"
        | "cancelled"
      library_item_type:
        | "book"
        | "journal"
        | "digital"
        | "magazine"
        | "reference"
      maintenance_priority: "low" | "medium" | "high" | "urgent"
      maintenance_status:
        | "pending"
        | "approved"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      maintenance_type: "corrective" | "preventive" | "predictive" | "breakdown"
      package_type: "basic" | "extended" | "professional"
      qualification_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
      qualification_type: "nvc" | "diploma"
      room_status: "available" | "occupied" | "maintenance" | "reserved"
      room_type: "single" | "double" | "dormitory" | "suite"
      trainee_status:
        | "active"
        | "completed"
        | "deferred"
        | "withdrawn"
        | "archived"
      training_mode: "fulltime" | "bdl" | "shortcourse"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_provisioning_status: [
        "not_started",
        "auto_provisioned",
        "manually_provisioned",
        "failed",
      ],
      allocation_status: ["active", "checked_out", "pending", "cancelled"],
      app_role: [
        "admin",
        "registration_officer",
        "debtor_officer",
        "trainer",
        "hod",
        "viewer",
        "assessment_coordinator",
        "super_admin",
        "organization_admin",
        "stock_control_officer",
        "asset_maintenance_coordinator",
        "procurement_officer",
        "maintenance_coordinator",
        "librarian",
        "hostel_coordinator",
        "placement_officer",
        "trainee",
        "vms_developer",
        "vms_support",
        "head_of_training",
        "head_of_trainee_support",
        "liaison_officer",
        "resource_center_coordinator",
        "projects_coordinator",
        "hr_officer",
        "bdl_coordinator",
        "rpl_coordinator",
        "head_trainee_support",
      ],
      approval_action: ["submitted", "approved", "rejected", "returned"],
      asset_condition: ["excellent", "good", "fair", "poor", "needs_repair"],
      asset_status: [
        "active",
        "under_repair",
        "disposed",
        "in_storage",
        "retired",
      ],
      bed_status: ["available", "occupied", "reserved", "maintenance"],
      borrowing_status: ["borrowed", "returned", "overdue"],
      duration_unit: ["months", "years"],
      employment_type: ["fulltime", "parttime", "contract"],
      fine_status: ["pending", "paid", "waived"],
      gender: ["male", "female", "other"],
      gender_type: ["male", "female", "mixed"],
      hostel_maintenance_status: [
        "reported",
        "in_progress",
        "completed",
        "cancelled",
      ],
      library_item_type: [
        "book",
        "journal",
        "digital",
        "magazine",
        "reference",
      ],
      maintenance_priority: ["low", "medium", "high", "urgent"],
      maintenance_status: [
        "pending",
        "approved",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      maintenance_type: ["corrective", "preventive", "predictive", "breakdown"],
      package_type: ["basic", "extended", "professional"],
      qualification_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
      ],
      qualification_type: ["nvc", "diploma"],
      room_status: ["available", "occupied", "maintenance", "reserved"],
      room_type: ["single", "double", "dormitory", "suite"],
      trainee_status: [
        "active",
        "completed",
        "deferred",
        "withdrawn",
        "archived",
      ],
      training_mode: ["fulltime", "bdl", "shortcourse"],
    },
  },
} as const
