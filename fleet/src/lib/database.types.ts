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
          app: string
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
          app?: string
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
          app?: string
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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          organization_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications: {
        Row: {
          body: string
          created_at: string | null
          customer_id: string
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          customer_id: string
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          avg_rating: number | null
          blocked: boolean | null
          blocked_reason: string | null
          created_at: string | null
          default_payment_method:
            | Database["public"]["Enums"]["ride_payment_method"]
            | null
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          last_ride_at: string | null
          phone: string
          push_platform: string | null
          push_token: string | null
          push_token_updated_at: string | null
          total_rides: number | null
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          avg_rating?: number | null
          blocked?: boolean | null
          blocked_reason?: string | null
          created_at?: string | null
          default_payment_method?:
            | Database["public"]["Enums"]["ride_payment_method"]
            | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          last_ride_at?: string | null
          phone: string
          push_platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          total_rides?: number | null
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          avg_rating?: number | null
          blocked?: boolean | null
          blocked_reason?: string | null
          created_at?: string | null
          default_payment_method?:
            | Database["public"]["Enums"]["ride_payment_method"]
            | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          last_ride_at?: string | null
          phone?: string
          push_platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          total_rides?: number | null
        }
        Relationships: []
      }
      fare_config: {
        Row: {
          base_fare: number
          effective_from: string | null
          effective_until: string | null
          id: string
          min_fare: number
          per_km: number
          per_min: number
          region_code: string
          surge_enabled: boolean | null
          vehicle_type: Database["public"]["Enums"]["ride_vehicle_type"]
        }
        Insert: {
          base_fare: number
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          min_fare: number
          per_km: number
          per_min: number
          region_code: string
          surge_enabled?: boolean | null
          vehicle_type: Database["public"]["Enums"]["ride_vehicle_type"]
        }
        Update: {
          base_fare?: number
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          min_fare?: number
          per_km?: number
          per_min?: number
          region_code?: string
          surge_enabled?: boolean | null
          vehicle_type?: Database["public"]["Enums"]["ride_vehicle_type"]
        }
        Relationships: []
      }
      fleets_visibility: {
        Row: {
          base_fare_override: number | null
          commission_rate: number | null
          id: string
          operating_hours: Json | null
          organization_id: string
          ride_enabled: boolean | null
          service_area: unknown
          updated_at: string | null
          vehicle_types_offered: string[] | null
        }
        Insert: {
          base_fare_override?: number | null
          commission_rate?: number | null
          id?: string
          operating_hours?: Json | null
          organization_id: string
          ride_enabled?: boolean | null
          service_area?: unknown
          updated_at?: string | null
          vehicle_types_offered?: string[] | null
        }
        Update: {
          base_fare_override?: number | null
          commission_rate?: number | null
          id?: string
          operating_hours?: Json | null
          organization_id?: string
          ride_enabled?: boolean | null
          service_area?: unknown
          updated_at?: string | null
          vehicle_types_offered?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fleets_visibility_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          ride_request_id: string | null
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
          ride_request_id?: string | null
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
          ride_request_id?: string | null
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
            foreignKeyName: "jobs_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
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
      payments: {
        Row: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          created_at: string | null
          currency: string | null
          failure_reason: string | null
          gateway: string | null
          gateway_payload: Json | null
          gateway_ref: string | null
          id: string
          method: Database["public"]["Enums"]["ride_payment_method"]
          refunded_at: string | null
          ride_request_id: string
          status: Database["public"]["Enums"]["ride_payment_status"] | null
        }
        Insert: {
          amount: number
          authorized_at?: string | null
          captured_at?: string | null
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          gateway?: string | null
          gateway_payload?: Json | null
          gateway_ref?: string | null
          id?: string
          method: Database["public"]["Enums"]["ride_payment_method"]
          refunded_at?: string | null
          ride_request_id: string
          status?: Database["public"]["Enums"]["ride_payment_status"] | null
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          captured_at?: string | null
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          gateway?: string | null
          gateway_payload?: Json | null
          gateway_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["ride_payment_method"]
          refunded_at?: string | null
          ride_request_id?: string
          status?: Database["public"]["Enums"]["ride_payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
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
          pre_trip_status:
            | Database["public"]["Enums"]["user_availability_status"]
            | null
          push_platform: string | null
          push_token: string | null
          push_token_updated_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_availability_status"]
          status_updated_at: string
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
          pre_trip_status?:
            | Database["public"]["Enums"]["user_availability_status"]
            | null
          push_platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_availability_status"]
          status_updated_at?: string
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
          pre_trip_status?:
            | Database["public"]["Enums"]["user_availability_status"]
            | null
          push_platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_availability_status"]
          status_updated_at?: string
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
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          ratee_id: string
          ratee_type: string
          rater_id: string
          rater_type: string
          ride_request_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          ratee_id: string
          ratee_type: string
          rater_id: string
          rater_type: string
          ride_request_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          ratee_id?: string
          ratee_type?: string
          rater_id?: string
          rater_type?: string
          ride_request_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          distance_meters: number
          driver_id: string
          eta_seconds: number
          expires_at: string
          id: string
          offered_at: string | null
          organization_id: string
          priority: number
          responded_at: string | null
          ride_request_id: string
          status: Database["public"]["Enums"]["ride_offer_status"] | null
          vehicle_id: string
        }
        Insert: {
          distance_meters: number
          driver_id: string
          eta_seconds: number
          expires_at: string
          id?: string
          offered_at?: string | null
          organization_id: string
          priority: number
          responded_at?: string | null
          ride_request_id: string
          status?: Database["public"]["Enums"]["ride_offer_status"] | null
          vehicle_id: string
        }
        Update: {
          distance_meters?: number
          driver_id?: string
          eta_seconds?: number
          expires_at?: string
          id?: string
          offered_at?: string | null
          organization_id?: string
          priority?: number
          responded_at?: string | null
          ride_request_id?: string
          status?: Database["public"]["Enums"]["ride_offer_status"] | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          arrived_at: string | null
          assigned_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          customer_id: string
          distance_km: number | null
          driver_id: string | null
          dropoff_address: string | null
          dropoff_point: unknown
          duration_min: number | null
          fare_estimate: number | null
          fare_final: number | null
          id: string
          job_id: string | null
          organization_id: string | null
          payment_method: Database["public"]["Enums"]["ride_payment_method"]
          payment_status:
            | Database["public"]["Enums"]["ride_payment_status"]
            | null
          pickup_address: string
          pickup_point: unknown
          requested_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          surge_multiplier: number | null
          vehicle_id: string | null
          vehicle_type: Database["public"]["Enums"]["ride_vehicle_type"] | null
        }
        Insert: {
          arrived_at?: string | null
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          customer_id: string
          distance_km?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_point?: unknown
          duration_min?: number | null
          fare_estimate?: number | null
          fare_final?: number | null
          id?: string
          job_id?: string | null
          organization_id?: string | null
          payment_method?: Database["public"]["Enums"]["ride_payment_method"]
          payment_status?:
            | Database["public"]["Enums"]["ride_payment_status"]
            | null
          pickup_address: string
          pickup_point: unknown
          requested_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          surge_multiplier?: number | null
          vehicle_id?: string | null
          vehicle_type?: Database["public"]["Enums"]["ride_vehicle_type"] | null
        }
        Update: {
          arrived_at?: string | null
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          customer_id?: string
          distance_km?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_point?: unknown
          duration_min?: number | null
          fare_estimate?: number | null
          fare_final?: number | null
          id?: string
          job_id?: string | null
          organization_id?: string | null
          payment_method?: Database["public"]["Enums"]["ride_payment_method"]
          payment_status?:
            | Database["public"]["Enums"]["ride_payment_status"]
            | null
          pickup_address?: string
          pickup_point?: unknown
          requested_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          surge_multiplier?: number | null
          vehicle_id?: string | null
          vehicle_type?: Database["public"]["Enums"]["ride_vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
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
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      cancel_ride: {
        Args: { p_reason?: string; p_ride_id: string }
        Returns: undefined
      }
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
      claim_vehicle_for_ride: {
        Args: { p_vehicle_id: string }
        Returns: string
      }
      cloudinary_public_id_from_url: { Args: { url: string }; Returns: string }
      complete_ride: {
        Args: {
          p_distance_km?: number
          p_duration_min?: number
          p_fare_final?: number
          p_ride_id: string
        }
        Returns: Database["public"]["Enums"]["ride_status"]
      }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_fleet: { Args: never; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      driver_arrived: {
        Args: { p_ride_id: string }
        Returns: Database["public"]["Enums"]["ride_status"]
      }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_vault_secret: { Args: { p_name: string }; Returns: string }
      gettransactionid: { Args: never; Returns: unknown }
      has_permission: {
        Args: { p_key: string; p_user_id: string }
        Returns: boolean
      }
      is_fleet_open: {
        Args: { p_at?: string; p_org_id: string }
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
      longtransactionsenabled: { Args: never; Returns: boolean }
      maintenance_cron_invoke: { Args: never; Returns: string }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
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
      request_account_deletion: { Args: never; Returns: Json }
      request_ride: {
        Args: {
          p_pickup_address: string
          p_pickup_lat: number
          p_pickup_lng: number
          p_vehicle_id: string
        }
        Returns: string
      }
      ride_active_driver_info: {
        Args: { p_ride_id: string }
        Returns: {
          brand: string
          color: string
          driver_avatar_url: string
          driver_id: string
          driver_name: string
          driver_phone: string
          hq_lat: number
          hq_lng: number
          model: string
          photo_url: string
          plate: string
          vehicle_id: string
        }[]
      }
      ride_search_vehicles: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: {
          brand: string
          color: string
          distance_km: number
          driver_avatar_url: string
          driver_id: string
          driver_name: string
          driver_phone: string
          hq_address: string
          hq_lat: number
          hq_lng: number
          model: string
          organization_id: string
          photo_url: string
          plate: string
          vehicle_id: string
          year: number
        }[]
      }
      set_my_status: {
        Args: {
          p_status: Database["public"]["Enums"]["user_availability_status"]
        }
        Returns: Database["public"]["Enums"]["user_availability_status"]
      }
      set_permission_override: {
        Args: { p_allowed: boolean; p_key: string; p_member_id: string }
        Returns: undefined
      }
      set_vault_secret: {
        Args: { p_name: string; p_value: string }
        Returns: string
      }
      simulate_ride_job: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      start_ride: {
        Args: { p_ride_id: string }
        Returns: Database["public"]["Enums"]["ride_status"]
      }
      submit_driver_rating: {
        Args: { p_comment?: string; p_ride_id: string; p_stars: number }
        Returns: string
      }
      submit_rating: {
        Args: { p_comment?: string; p_ride_id: string; p_stars: number }
        Returns: string
      }
      transfer_ownership: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
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
      ride_offer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      ride_payment_method: "cash" | "card" | "wallet"
      ride_payment_status:
        | "pending"
        | "authorized"
        | "captured"
        | "refunded"
        | "failed"
        | "paid_cash"
      ride_status:
        | "searching"
        | "no_drivers_available"
        | "assigned"
        | "driver_arrived"
        | "in_progress"
        | "completed"
        | "cancelled_by_customer"
        | "cancelled_by_driver"
        | "cancelled_by_system"
      ride_vehicle_type: "standard" | "comfort" | "xl" | "taxi"
      user_availability_status:
        | "active"
        | "break"
        | "off_duty"
        | "on_trip"
        | "unavailable"
      user_role: "owner" | "manager" | "driver"
      vehicle_status: "active" | "maintenance" | "idle"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      job_source: ["internal", "driver_request", "ride"],
      job_status: [
        "open",
        "assigned",
        "in_progress",
        "completed",
        "failed",
        "cancelled",
      ],
      ride_offer_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      ride_payment_method: ["cash", "card", "wallet"],
      ride_payment_status: [
        "pending",
        "authorized",
        "captured",
        "refunded",
        "failed",
        "paid_cash",
      ],
      ride_status: [
        "searching",
        "no_drivers_available",
        "assigned",
        "driver_arrived",
        "in_progress",
        "completed",
        "cancelled_by_customer",
        "cancelled_by_driver",
        "cancelled_by_system",
      ],
      ride_vehicle_type: ["standard", "comfort", "xl", "taxi"],
      user_availability_status: [
        "active",
        "break",
        "off_duty",
        "on_trip",
        "unavailable",
      ],
      user_role: ["owner", "manager", "driver"],
      vehicle_status: ["active", "maintenance", "idle"],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Named exports — fleet kod tabanı bu kısa isimleri kullanıyor.
// Supabase CLI auto-gen sadece Database tipini export eder; aşağıdaki kısa
// aliaslar gen:types sonrası elle korunur. Yeni tablo/enum eklenirse
// burayı da güncelle.
// ---------------------------------------------------------------------------
export type Job = Database["public"]["Tables"]["jobs"]["Row"]
export type JobStatus = Database["public"]["Enums"]["job_status"]
export type JobSource = Database["public"]["Enums"]["job_source"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"]
export type VehicleStatus = Database["public"]["Enums"]["vehicle_status"]
export type MaintenanceRequest =
  Database["public"]["Tables"]["maintenance_requests"]["Row"]
export type UserRole = Database["public"]["Enums"]["user_role"]
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"]
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
