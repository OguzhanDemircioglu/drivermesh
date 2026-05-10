export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          full_name: string;
          id: string;
          invited_by: string;
          organization_id: string;
          role: Database['public']['Enums']['user_role'];
          status: Database['public']['Enums']['invitation_status'];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          full_name: string;
          id?: string;
          invited_by: string;
          organization_id: string;
          role: Database['public']['Enums']['user_role'];
          status?: Database['public']['Enums']['invitation_status'];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          full_name?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['user_role'];
          status?: Database['public']['Enums']['invitation_status'];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_accepted_by_fkey';
            columns: ['accepted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          assigned_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          customer_name: string;
          distance_km: number | null;
          driver_id: string | null;
          dropoff_address: string;
          dropoff_lat: number | null;
          dropoff_lng: number | null;
          eta_minutes: number | null;
          fail_reason: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          pickup_address: string;
          pickup_lat: number | null;
          pickup_lng: number | null;
          source: Database['public']['Enums']['job_source'];
          started_at: string | null;
          status: Database['public']['Enums']['job_status'];
          vehicle_id: string | null;
        };
        Insert: {
          assigned_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          customer_name: string;
          distance_km?: number | null;
          driver_id?: string | null;
          dropoff_address: string;
          dropoff_lat?: number | null;
          dropoff_lng?: number | null;
          eta_minutes?: number | null;
          fail_reason?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          pickup_address: string;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          source?: Database['public']['Enums']['job_source'];
          started_at?: string | null;
          status?: Database['public']['Enums']['job_status'];
          vehicle_id?: string | null;
        };
        Update: {
          assigned_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          customer_name?: string;
          distance_km?: number | null;
          driver_id?: string | null;
          dropoff_address?: string;
          dropoff_lat?: number | null;
          dropoff_lng?: number | null;
          eta_minutes?: number | null;
          fail_reason?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          pickup_address?: string;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          source?: Database['public']['Enums']['job_source'];
          started_at?: string | null;
          status?: Database['public']['Enums']['job_status'];
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          payload: Json;
          read_at: string | null;
          recipient_id: string;
          type: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          payload?: Json;
          read_at?: string | null;
          recipient_id: string;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          hq_address: string | null;
          hq_lat: number | null;
          hq_lng: number | null;
          id: string;
          name: string;
          owner_id: string;
          feedback_email_address: string | null;
          feedback_email_enabled: boolean;
          feedback_push_enabled: boolean;
          feedback_telegram_enabled: boolean;
          feedback_telegram_bot_username: string | null;
          feedback_telegram_bot_token: string | null;
          feedback_telegram_chat_id: string | null;
        };
        Insert: {
          created_at?: string;
          hq_address?: string | null;
          hq_lat?: number | null;
          hq_lng?: number | null;
          id?: string;
          name: string;
          owner_id: string;
          feedback_email_address?: string | null;
          feedback_email_enabled?: boolean;
          feedback_push_enabled?: boolean;
          feedback_telegram_enabled?: boolean;
          feedback_telegram_bot_username?: string | null;
          feedback_telegram_bot_token?: string | null;
          feedback_telegram_chat_id?: string | null;
        };
        Update: {
          created_at?: string;
          hq_address?: string | null;
          hq_lat?: number | null;
          hq_lng?: number | null;
          id?: string;
          name?: string;
          owner_id?: string;
          feedback_email_address?: string | null;
          feedback_email_enabled?: boolean;
          feedback_push_enabled?: boolean;
          feedback_telegram_enabled?: boolean;
          feedback_telegram_bot_username?: string | null;
          feedback_telegram_bot_token?: string | null;
          feedback_telegram_chat_id?: string | null;
        };
        Relationships: [];
      };
      permission_keys: {
        Row: {
          category: string;
          is_critical: boolean;
          key: string;
          label_en: string;
          label_tr: string;
          sort_order: number;
        };
        Insert: {
          category: string;
          is_critical?: boolean;
          key: string;
          label_en: string;
          label_tr: string;
          sort_order?: number;
        };
        Update: {
          category?: string;
          is_critical?: boolean;
          key?: string;
          label_en?: string;
          label_tr?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      permission_overrides: {
        Row: {
          allowed: boolean;
          created_at: string;
          granted_by: string;
          id: string;
          key: string;
          organization_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allowed: boolean;
          created_at?: string;
          granted_by: string;
          id?: string;
          key: string;
          organization_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allowed?: boolean;
          created_at?: string;
          granted_by?: string;
          id?: string;
          key?: string;
          organization_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'permission_overrides_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'permission_overrides_key_fkey';
            columns: ['key'];
            isOneToOne: false;
            referencedRelation: 'permission_keys';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'permission_overrides_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'permission_overrides_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          organization_id: string | null;
          phone: string | null;
          role: Database['public']['Enums']['user_role'];
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          organization_id?: string | null;
          phone?: string | null;
          role: Database['public']['Enums']['user_role'];
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          organization_id?: string | null;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      role_default_permissions: {
        Row: {
          allowed: boolean;
          key: string;
          role: Database['public']['Enums']['user_role'];
        };
        Insert: {
          allowed: boolean;
          key: string;
          role: Database['public']['Enums']['user_role'];
        };
        Update: {
          allowed?: boolean;
          key?: string;
          role?: Database['public']['Enums']['user_role'];
        };
        Relationships: [
          {
            foreignKeyName: 'role_default_permissions_key_fkey';
            columns: ['key'];
            isOneToOne: false;
            referencedRelation: 'permission_keys';
            referencedColumns: ['key'];
          },
        ];
      };
      vehicles: {
        Row: {
          added_by: string;
          brand: string;
          color: string | null;
          created_at: string;
          id: string;
          is_at_hq: boolean;
          model: string;
          organization_id: string;
          photo_url: string | null;
          plate: string;
          status: Database['public']['Enums']['vehicle_status'];
          year: number;
        };
        Insert: {
          added_by: string;
          brand: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          is_at_hq?: boolean;
          model: string;
          organization_id: string;
          photo_url?: string | null;
          plate: string;
          status?: Database['public']['Enums']['vehicle_status'];
          year: number;
        };
        Update: {
          added_by?: string;
          brand?: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          is_at_hq?: boolean;
          model?: string;
          organization_id?: string;
          photo_url?: string | null;
          plate?: string;
          status?: Database['public']['Enums']['vehicle_status'];
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_org_id: { Args: Record<string, never>; Returns: string };
      current_user_role: {
        Args: Record<string, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      has_permission: {
        Args: { p_key: string; p_user_id: string };
        Returns: boolean;
      };
      list_member_permissions: {
        Args: { p_member_id: string };
        Returns: Array<{
          category: string;
          default_allowed: boolean;
          effective_allowed: boolean;
          is_critical: boolean;
          key: string;
          label_en: string;
          label_tr: string;
          override_allowed: boolean;
          sort_order: number;
        }>;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: void;
      };
      redeem_invitation_complete: {
        Args: { p_short_code: string };
        Returns: string;
      };
      redeem_invitation_lookup: {
        Args: { p_short_code: string };
        Returns: Array<{
          invitation_id: string;
          organization_id: string;
          organization_name: string;
          full_name: string;
          email: string;
          role: Database['public']['Enums']['user_role'];
        }>;
      };
      set_permission_override: {
        Args: { p_allowed: boolean; p_key: string; p_member_id: string };
        Returns: void;
      };
      simulate_ride_job: {
        Args: Record<string, never>;
        Returns: string;
      };
      transfer_ownership: {
        Args: { target_user_id: string };
        Returns: void;
      };
      delete_fleet: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: {
      invitation_status: 'pending' | 'accepted' | 'expired' | 'revoked';
      job_source: 'internal' | 'driver_request' | 'ride';
      job_status:
        | 'open'
        | 'assigned'
        | 'in_progress'
        | 'completed'
        | 'failed'
        | 'cancelled';
      user_role: 'owner' | 'manager' | 'driver';
      vehicle_status: 'active' | 'maintenance' | 'idle';
    };
    CompositeTypes: Record<string, never>;
  };
};

// ============================================================
// Helper exports — used across the app
// ============================================================

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type Invitation = Database['public']['Tables']['invitations']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type Job = Database['public']['Tables']['jobs']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PermissionKey = Database['public']['Tables']['permission_keys']['Row'];
export type PermissionOverride = Database['public']['Tables']['permission_overrides']['Row'];
export type RoleDefaultPermission = Database['public']['Tables']['role_default_permissions']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];
export type JobStatus = Database['public']['Enums']['job_status'];
export type JobSource = Database['public']['Enums']['job_source'];
export type VehicleStatus = Database['public']['Enums']['vehicle_status'];
export type InvitationStatus = Database['public']['Enums']['invitation_status'];
