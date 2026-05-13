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
      app_versions: {
        Row: {
          force_update_message_en: string
          force_update_message_tr: string
          latest_version: string
          min_supported_version: string
          platform: string
          release_notes_en: string | null
          release_notes_tr: string | null
          store_url: string
          updated_at: string
        }
        Insert: {
          force_update_message_en?: string
          force_update_message_tr?: string
          latest_version: string
          min_supported_version: string
          platform: string
          release_notes_en?: string | null
          release_notes_tr?: string | null
          store_url: string
          updated_at?: string
        }
        Update: {
          force_update_message_en?: string
          force_update_message_tr?: string
          latest_version?: string
          min_supported_version?: string
          platform?: string
          release_notes_en?: string | null
          release_notes_tr?: string | null
          store_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          manager_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          manager_id?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          manager_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_name: string
          distance_km: number | null
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          eta_minutes: number | null
          fail_reason: string | null
          id: string
          notes: string | null
          organization_id: string
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          source: Database["public"]["Enums"]["job_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          vehicle_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_name: string
          distance_km?: number | null
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          eta_minutes?: number | null
          fail_reason?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          source?: Database["public"]["Enums"]["job_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          vehicle_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string
          distance_km?: number | null
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          eta_minutes?: number | null
          fail_reason?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          source?: Database["public"]["Enums"]["job_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          ai_score: number | null
          authenticity_checked_at: string | null
          authenticity_metadata: Json | null
          content_class: string | null
          content_score: number | null
          content_top_label: string | null
          decided_at: string | null
          decided_by: string | null
          estimated_minutes: number | null
          exif_status: string | null
          id: string
          organization_id: string
          photo_urls: string[]
          reason: string
          rejection_reason: string | null
          requested_at: string
          requester_id: string
          status: string
          suspected_ai: boolean | null
          vehicle_id: string
        }
        Insert: {
          ai_score?: number | null
          authenticity_checked_at?: string | null
          authenticity_metadata?: Json | null
          content_class?: string | null
          content_score?: number | null
          content_top_label?: string | null
          decided_at?: string | null
          decided_by?: string | null
          estimated_minutes?: number | null
          exif_status?: string | null
          id?: string
          organization_id: string
          photo_urls?: string[]
          reason: string
          rejection_reason?: string | null
          requested_at?: string
          requester_id: string
          status?: string
          suspected_ai?: boolean | null
          vehicle_id: string
        }
        Update: {
          ai_score?: number | null
          authenticity_checked_at?: string | null
          authenticity_metadata?: Json | null
          content_class?: string | null
          content_score?: number | null
          content_top_label?: string | null
          decided_at?: string | null
          decided_by?: string | null
          estimated_minutes?: number | null
          exif_status?: string | null
          id?: string
          organization_id?: string
          photo_urls?: string[]
          reason?: string
          rejection_reason?: string | null
          requested_at?: string
          requester_id?: string
          status?: string
          suspected_ai?: boolean | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          organization_id: string
          payload: Json
          read_at: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json
          read_at?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          feedback_email_address: string | null
          feedback_email_enabled: boolean
          feedback_push_enabled: boolean
          feedback_telegram_bot_token: string | null
          feedback_telegram_bot_username: string | null
          feedback_telegram_chat_id: string | null
          feedback_telegram_enabled: boolean
          hq_address: string | null
          hq_lat: number | null
          hq_lng: number | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          feedback_email_address?: string | null
          feedback_email_enabled?: boolean
          feedback_push_enabled?: boolean
          feedback_telegram_bot_token?: string | null
          feedback_telegram_bot_username?: string | null
          feedback_telegram_chat_id?: string | null
          feedback_telegram_enabled?: boolean
          hq_address?: string | null
          hq_lat?: number | null
          hq_lng?: number | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          feedback_email_address?: string | null
          feedback_email_enabled?: boolean
          feedback_push_enabled?: boolean
          feedback_telegram_bot_token?: string | null
          feedback_telegram_bot_username?: string | null
          feedback_telegram_chat_id?: string | null
          feedback_telegram_enabled?: boolean
          hq_address?: string | null
          hq_lat?: number | null
          hq_lng?: number | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      permission_keys: {
        Row: {
          category: string
          is_critical: boolean
          key: string
          label_en: string
          label_tr: string
          sort_order: number
        }
        Insert: {
          category: string
          is_critical?: boolean
          key: string
          label_en: string
          label_tr: string
          sort_order?: number
        }
        Update: {
          category?: string
          is_critical?: boolean
          key?: string
          label_en?: string
          label_tr?: string
          sort_order?: number
        }
        Relationships: []
      }
      permission_overrides: {
        Row: {
          allowed: boolean
          created_at: string
          granted_by: string
          id: string
          key: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed: boolean
          created_at?: string
          granted_by: string
          id?: string
          key: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          granted_by?: string
          id?: string
          key?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_overrides_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "permission_keys"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "permission_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          manager_id: string | null
          organization_id: string | null
          phone: string | null
          push_platform: string | null
          push_token: string | null
          push_token_updated_at: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          manager_id?: string | null
          organization_id?: string | null
          phone?: string | null
          push_platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          manager_id?: string | null
          organization_id?: string | null
          phone?: string | null
          push_platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_default_permissions: {
        Row: {
          allowed: boolean
          key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          allowed: boolean
          key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          allowed?: boolean
          key?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_default_permissions_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "permission_keys"
            referencedColumns: ["key"]
          },
        ]
      }
      vehicle_assignments: {
        Row: {
          claimed_at: string
          id: string
          organization_id: string
          reason: string
          released_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          organization_id: string
          reason?: string
          released_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          organization_id?: string
          reason?: string
          released_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          added_by: string
          ai_score: number | null
          authenticity_checked_at: string | null
          authenticity_metadata: Json | null
          brand: string
          color: string | null
          content_class: string | null
          content_score: number | null
          content_top_label: string | null
          created_at: string
          current_user_id: string | null
          exif_status: string | null
          id: string
          is_at_hq: boolean
          maintenance_photo_urls: string[]
          maintenance_reason: string | null
          maintenance_started_at: string | null
          maintenance_started_by: string | null
          maintenance_until: string | null
          model: string
          organization_id: string
          photo_url: string | null
          plate: string
          status: Database["public"]["Enums"]["vehicle_status"]
          suspected_ai: boolean | null
          year: number
        }
        Insert: {
          added_by: string
          ai_score?: number | null
          authenticity_checked_at?: string | null
          authenticity_metadata?: Json | null
          brand: string
          color?: string | null
          content_class?: string | null
          content_score?: number | null
          content_top_label?: string | null
          created_at?: string
          current_user_id?: string | null
          exif_status?: string | null
          id?: string
          is_at_hq?: boolean
          maintenance_photo_urls?: string[]
          maintenance_reason?: string | null
          maintenance_started_at?: string | null
          maintenance_started_by?: string | null
          maintenance_until?: string | null
          model: string
          organization_id: string
          photo_url?: string | null
          plate: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          suspected_ai?: boolean | null
          year: number
        }
        Update: {
          added_by?: string
          ai_score?: number | null
          authenticity_checked_at?: string | null
          authenticity_metadata?: Json | null
          brand?: string
          color?: string | null
          content_class?: string | null
          content_score?: number | null
          content_top_label?: string | null
          created_at?: string
          current_user_id?: string | null
          exif_status?: string | null
          id?: string
          is_at_hq?: boolean
          maintenance_photo_urls?: string[]
          maintenance_reason?: string | null
          maintenance_started_at?: string | null
          maintenance_started_by?: string | null
          maintenance_until?: string | null
          model?: string
          organization_id?: string
          photo_url?: string | null
          plate?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          suspected_ai?: boolean | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_current_user_id_fkey"
            columns: ["current_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_maintenance_started_by_fkey"
            columns: ["maintenance_started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_member_role: {
        Args: {
          p_member_id: string
          p_new_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: undefined
      }
      claim_vehicle: {
        Args: { p_reason?: string; p_vehicle_id: string }
        Returns: undefined
      }
      cloudinary_public_id_from_url: { Args: { url: string }; Returns: string }
      current_user_org_id: { Args: Record<string, never>; Returns: string }
      current_user_role: {
        Args: Record<string, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_fleet: { Args: Record<string, never>; Returns: undefined }
      get_vault_secret: { Args: { p_name: string }; Returns: string }
      has_permission: {
        Args: { p_key: string; p_user_id: string }
        Returns: boolean
      }
      list_member_permissions: {
        Args: { p_member_id: string }
        Returns: {
          category: string
          default_allowed: boolean
          effective_allowed: boolean
          is_critical: boolean
          key: string
          label_en: string
          label_tr: string
          override_allowed: boolean
          sort_order: number
        }[]
      }
      maintenance_cron_invoke: { Args: Record<string, never>; Returns: string }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      redeem_invitation_complete: {
        Args: { p_short_code: string }
        Returns: string
      }
      redeem_invitation_lookup: {
        Args: { p_short_code: string }
        Returns: {
          email: string
          full_name: string
          invitation_id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      release_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      remove_org_member: { Args: { p_member_id: string }; Returns: undefined }
      request_account_deletion: { Args: Record<string, never>; Returns: Json }
      set_permission_override: {
        Args: { p_allowed: boolean; p_key: string; p_member_id: string }
        Returns: undefined
      }
      set_vault_secret: {
        Args: { p_name: string; p_value: string }
        Returns: string
      }
      simulate_ride_job: { Args: Record<string, never>; Returns: string }
      transfer_ownership: {
        Args: { target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      job_source: "internal" | "driver_request" | "ride"
      job_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "completed"
        | "failed"
        | "cancelled"
      user_role: "owner" | "manager" | "driver"
      vehicle_status: "active" | "maintenance" | "idle"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================
// Helper exports — used across the app
// ============================================================

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"]
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"]
export type Job = Database["public"]["Tables"]["jobs"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type PermissionKey = Database["public"]["Tables"]["permission_keys"]["Row"]
export type PermissionOverride = Database["public"]["Tables"]["permission_overrides"]["Row"]
export type RoleDefaultPermission = Database["public"]["Tables"]["role_default_permissions"]["Row"]
export type MaintenanceRequest = Database["public"]["Tables"]["maintenance_requests"]["Row"]
export type MaintenanceRequestStatus = MaintenanceRequest["status"]
export type VehicleAssignment = Database["public"]["Tables"]["vehicle_assignments"]["Row"]
export type VehicleAssignmentReason = VehicleAssignment["reason"]
export type UserRole = Database["public"]["Enums"]["user_role"]
export type JobStatus = Database["public"]["Enums"]["job_status"]
export type JobSource = Database["public"]["Enums"]["job_source"]
export type VehicleStatus = Database["public"]["Enums"]["vehicle_status"]
export type InvitationStatus = Database["public"]["Enums"]["invitation_status"]
export type AppVersion = Database["public"]["Tables"]["app_versions"]["Row"]
