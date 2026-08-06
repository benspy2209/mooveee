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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          child_id: string
          created_at: string
          ends_at: string | null
          household_id: string
          hub_id: string | null
          id: string
          label: string
          lat: number | null
          lng: number | null
          location_label: string | null
          rrule: string | null
          starts_at: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          ends_at?: string | null
          household_id: string
          hub_id?: string | null
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          rrule?: string | null
          starts_at?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          ends_at?: string | null
          household_id?: string
          hub_id?: string | null
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          rrule?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      children: {
        Row: {
          birth_year: number | null
          booster_seat: boolean
          created_at: string
          first_name: string
          household_id: string
          id: string
          photo_consent: boolean
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_year?: number | null
          booster_seat?: boolean
          created_at?: string
          first_name: string
          household_id: string
          id?: string
          photo_consent?: boolean
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number | null
          booster_seat?: boolean
          created_at?: string
          first_name?: string
          household_id?: string
          id?: string
          photo_consent?: boolean
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          granted: boolean
          granted_at: string
          id: string
          policy_version: string
          revoked_at: string | null
          type: Database["public"]["Enums"]["consent_type"]
          user_id: string
        }
        Insert: {
          granted: boolean
          granted_at?: string
          id?: string
          policy_version: string
          revoked_at?: string | null
          type: Database["public"]["Enums"]["consent_type"]
          user_id: string
        }
        Update: {
          granted?: boolean
          granted_at?: string
          id?: string
          policy_version?: string
          revoked_at?: string | null
          type?: Database["public"]["Enums"]["consent_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      defraiement_records: {
        Row: {
          amount_eur: number
          created_at: string
          distance_km: number
          exported_at: string | null
          id: string
          performed_on: string
          trip_id: string
          volunteer_recognition_id: string
        }
        Insert: {
          amount_eur: number
          created_at?: string
          distance_km: number
          exported_at?: string | null
          id?: string
          performed_on: string
          trip_id: string
          volunteer_recognition_id: string
        }
        Update: {
          amount_eur?: number
          created_at?: string
          distance_km?: number
          exported_at?: string | null
          id?: string
          performed_on?: string
          trip_id?: string
          volunteer_recognition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defraiement_records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defraiement_records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defraiement_records_volunteer_recognition_id_fkey"
            columns: ["volunteer_recognition_id"]
            isOneToOne: false
            referencedRelation: "volunteer_recognitions"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          created_at: string
          email: string
          household_id: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["household_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          household_id: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["household_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          household_id?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["household_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          is_admin: boolean
          joined_at: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_bridges: {
        Row: {
          approved_at: string | null
          bridge_type: string
          created_at: string
          id: string
          is_active: boolean
          source_hub_id: string
          target_hub_id: string
        }
        Insert: {
          approved_at?: string | null
          bridge_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          source_hub_id: string
          target_hub_id: string
        }
        Update: {
          approved_at?: string | null
          bridge_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          source_hub_id?: string
          target_hub_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_bridges_source_hub_id_fkey"
            columns: ["source_hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_bridges_target_hub_id_fkey"
            columns: ["target_hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_members: {
        Row: {
          household_id: string
          hub_id: string
          id: string
          is_admin: boolean
          joined_at: string
          user_id: string
          validated_at: string | null
        }
        Insert: {
          household_id: string
          hub_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          user_id: string
          validated_at?: string | null
        }
        Update: {
          household_id?: string
          hub_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_members_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_pact_acceptances: {
        Row: {
          accepted_at: string
          hub_id: string
          id: string
          pact_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          hub_id: string
          id?: string
          pact_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          hub_id?: string
          id?: string
          pact_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_pact_acceptances_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_pact_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hubs: {
        Row: {
          activated_at: string | null
          certified_at: string | null
          created_at: string
          id: string
          institution_id: string | null
          join_code: string
          kind: Database["public"]["Enums"]["hub_kind"]
          municipality: string
          name: string
          owner_id: string
          place_label: string
          place_lat: number | null
          place_lng: number | null
          status: Database["public"]["Enums"]["hub_status"]
        }
        Insert: {
          activated_at?: string | null
          certified_at?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          join_code: string
          kind: Database["public"]["Enums"]["hub_kind"]
          municipality: string
          name: string
          owner_id: string
          place_label: string
          place_lat?: number | null
          place_lng?: number | null
          status?: Database["public"]["Enums"]["hub_status"]
        }
        Update: {
          activated_at?: string | null
          certified_at?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          join_code?: string
          kind?: Database["public"]["Enums"]["hub_kind"]
          municipality?: string
          name?: string
          owner_id?: string
          place_label?: string
          place_lat?: number | null
          place_lng?: number | null
          status?: Database["public"]["Enums"]["hub_status"]
        }
        Relationships: [
          {
            foreignKeyName: "hubs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_snapshots: {
        Row: {
          co2_saved_kg: number | null
          computed_at: string
          families_count: number
          hub_id: string | null
          id: string
          km_saved: number | null
          municipality: string | null
          period_month: string
          trips_shared: number
        }
        Insert: {
          co2_saved_kg?: number | null
          computed_at?: string
          families_count: number
          hub_id?: string | null
          id?: string
          km_saved?: number | null
          municipality?: string | null
          period_month: string
          trips_shared: number
        }
        Update: {
          co2_saved_kg?: number | null
          computed_at?: string
          families_count?: number
          hub_id?: string | null
          id?: string
          km_saved?: number | null
          municipality?: string | null
          period_month?: string
          trips_shared?: number
        }
        Relationships: [
          {
            foreignKeyName: "impact_snapshots_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_usage_metrics: {
        Row: {
          active_families: number
          computed_at: string
          features_enabled: Json
          hubs_count: number
          id: string
          institution_id: string
          period_month: string
          trips_volume: number
        }
        Insert: {
          active_families?: number
          computed_at?: string
          features_enabled?: Json
          hubs_count?: number
          id?: string
          institution_id: string
          period_month: string
          trips_volume?: number
        }
        Update: {
          active_families?: number
          computed_at?: string
          features_enabled?: Json
          hubs_count?: number
          id?: string
          institution_id?: string
          period_month?: string
          trips_volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "institution_usage_metrics_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_messages: {
        Row: {
          author_id: string
          body: string
          hub_id: string
          id: string
          institution_id: string
          published_at: string
          title: string
        }
        Insert: {
          author_id: string
          body: string
          hub_id: string
          id?: string
          institution_id: string
          published_at?: string
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          hub_id?: string
          id?: string
          institution_id?: string
          published_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_messages_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_messages_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          kind: string
          name: string
          tier: string | null
          vat_number: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          tier?: string | null
          vat_number?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          tier?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      meeting_points: {
        Row: {
          created_at: string
          description: string | null
          hub_id: string
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          hub_id: string
          id?: string
          is_default?: boolean
          label: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          hub_id?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_points_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          body: string
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          household_id: string | null
          hub_id: string | null
          id: string
          trip_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          household_id?: string | null
          hub_id?: string | null
          id?: string
          trip_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          household_id?: string | null
          hub_id?: string | null
          id?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      mooves_balance: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mooves_balance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mooves_ledger: {
        Row: {
          amount: number
          created_at: string
          grant_id: string | null
          id: string
          movement: Database["public"]["Enums"]["moove_movement"]
          reason: string | null
          trip_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          grant_id?: string | null
          id?: string
          movement: Database["public"]["Enums"]["moove_movement"]
          reason?: string | null
          trip_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          grant_id?: string | null
          id?: string
          movement?: Database["public"]["Enums"]["moove_movement"]
          reason?: string | null
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mooves_ledger_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mooves_ledger_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mooves_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          body: string
          category: string
          created_at: string
          hub_id: string | null
          id: string
          involves_minor: boolean
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_user_id: string | null
          trip_id: string | null
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          hub_id?: string | null
          id?: string
          involves_minor?: boolean
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
          trip_id?: string | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          hub_id?: string | null
          id?: string
          involves_minor?: boolean
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      solidarity_fund_grants: {
        Row: {
          amount: number
          beneficiary_id: string
          created_at: string
          granted_by: string | null
          id: string
          institution_id: string | null
          reason: string | null
          sponsor_label: string | null
        }
        Insert: {
          amount: number
          beneficiary_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          institution_id?: string | null
          reason?: string | null
          sponsor_label?: string | null
        }
        Update: {
          amount?: number
          beneficiary_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          institution_id?: string | null
          reason?: string | null
          sponsor_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solidarity_fund_grants_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solidarity_fund_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solidarity_fund_grants_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_children: {
        Row: {
          child_id: string
          trip_id: string
        }
        Insert: {
          child_id: string
          trip_id: string
        }
        Update: {
          child_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_children_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_children_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_dropoff_confirmations: {
        Row: {
          child_id: string
          confirmed_at: string
          confirmed_by: string
          id: string
          trip_id: string
        }
        Insert: {
          child_id: string
          confirmed_at?: string
          confirmed_by: string
          id?: string
          trip_id: string
        }
        Update: {
          child_id?: string
          confirmed_at?: string
          confirmed_by?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_dropoff_confirmations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_dropoff_confirmations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_dropoff_confirmations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_dropoff_confirmations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_requests: {
        Row: {
          child_id: string
          created_at: string
          id: string
          message: string | null
          requester_household_id: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["trip_request_status"]
          trip_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          message?: string | null
          requester_household_id: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["trip_request_status"]
          trip_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          message?: string | null
          requester_household_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["trip_request_status"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_requester_household_id_fkey"
            columns: ["requester_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "hub_trips_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          activity_id: string | null
          created_at: string
          destination_label: string | null
          destination_lat: number | null
          destination_lng: number | null
          direction: Database["public"]["Enums"]["trip_direction"]
          distance_km: number | null
          driver_id: string | null
          household_id: string
          hub_id: string | null
          id: string
          meeting_point_id: string | null
          origin_label: string | null
          origin_lat: number | null
          origin_lng: number | null
          private_note: string | null
          published_to_hub: boolean
          scheduled_at: string
          seats_available: number | null
          seats_total: number | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          destination_label?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          direction: Database["public"]["Enums"]["trip_direction"]
          distance_km?: number | null
          driver_id?: string | null
          household_id: string
          hub_id?: string | null
          id?: string
          meeting_point_id?: string | null
          origin_label?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          private_note?: string | null
          published_to_hub?: boolean
          scheduled_at: string
          seats_available?: number | null
          seats_total?: number | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          destination_label?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          direction?: Database["public"]["Enums"]["trip_direction"]
          distance_km?: number | null
          driver_id?: string | null
          household_id?: string
          hub_id?: string | null
          id?: string
          meeting_point_id?: string | null
          origin_label?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          private_note?: string | null
          published_to_hub?: boolean
          scheduled_at?: string
          seats_available?: number | null
          seats_total?: number | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_meeting_point_id_fkey"
            columns: ["meeting_point_id"]
            isOneToOne: false
            referencedRelation: "meeting_points"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string | null
          locale: string
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name: string
          id: string
          last_name?: string | null
          locale?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string | null
          locale?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_recognitions: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          is_active: boolean
          rate_eur_per_km: number
          user_id: string
          valid_from: string
          valid_until: string | null
          vector_type: Database["public"]["Enums"]["volunteer_vector"]
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          is_active?: boolean
          rate_eur_per_km: number
          user_id: string
          valid_from: string
          valid_until?: string | null
          vector_type: Database["public"]["Enums"]["volunteer_vector"]
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          rate_eur_per_km?: number
          user_id?: string
          valid_from?: string
          valid_until?: string | null
          vector_type?: Database["public"]["Enums"]["volunteer_vector"]
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_recognitions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_recognitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      hub_trips_view: {
        Row: {
          children_count: number | null
          destination_label: string | null
          direction: Database["public"]["Enums"]["trip_direction"] | null
          driver_first_name: string | null
          driver_id: string | null
          hub_id: string | null
          id: string | null
          meeting_point_id: string | null
          origin_label: string | null
          scheduled_at: string | null
          seats_available: number | null
          status: Database["public"]["Enums"]["trip_status"] | null
        }
        Insert: {
          children_count?: never
          destination_label?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          driver_first_name?: never
          driver_id?: string | null
          hub_id?: string | null
          id?: string | null
          meeting_point_id?: string | null
          origin_label?: string | null
          scheduled_at?: string | null
          seats_available?: number | null
          status?: Database["public"]["Enums"]["trip_status"] | null
        }
        Update: {
          children_count?: never
          destination_label?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          driver_first_name?: never
          driver_id?: string | null
          hub_id?: string | null
          id?: string | null
          meeting_point_id?: string | null
          origin_label?: string | null
          scheduled_at?: string | null
          seats_available?: number | null
          status?: Database["public"]["Enums"]["trip_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_meeting_point_id_fkey"
            columns: ["meeting_point_id"]
            isOneToOne: false
            referencedRelation: "meeting_points"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_trip_request: { Args: { p_request: string }; Returns: undefined }
      hub_trip_matching_needs_count: {
        Args: { p_trip: string }
        Returns: number
      }
      auth_admin_household_ids: { Args: never; Returns: string[] }
      auth_household_ids: { Args: never; Returns: string[] }
      auth_household_member_ids: { Args: never; Returns: string[] }
      auth_hub_admin_ids: { Args: never; Returns: string[] }
      auth_hub_ids: { Args: never; Returns: string[] }
      auth_hub_member_user_ids: { Args: never; Returns: string[] }
      child_belongs_to_household: {
        Args: { p_child: string; p_household: string }
        Returns: boolean
      }
      hub_for_join_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          kind: Database["public"]["Enums"]["hub_kind"]
          municipality: string
          name: string
        }[]
      }
      hub_member_profiles: {
        Args: { p_hub: string }
        Returns: {
          first_name: string
          is_admin: boolean
          last_name: string
          user_id: string
          validated_at: string
        }[]
      }
      hub_trip_children_count: { Args: { p_trip: string }; Returns: number }
      hub_user_first_name: { Args: { p_user: string }; Returns: string }
      mooves_amount_for_distance: { Args: { p_km: number }; Returns: number }
      mooves_apply_movement: {
        Args: {
          p_amount: number
          p_grant?: string
          p_movement: Database["public"]["Enums"]["moove_movement"]
          p_reason?: string
          p_trip?: string
          p_user: string
        }
        Returns: undefined
      }
      trip_child_household_match: {
        Args: { p_child: string; p_trip: string }
        Returns: boolean
      }
      trip_child_hub_request_accepted: {
        Args: { p_child: string; p_trip: string }
        Returns: boolean
      }
    }
    Enums: {
      channel_type: "cercle_intime" | "hub" | "broadcast_institutionnel"
      consent_type:
        | "inscription"
        | "cercle_intime"
        | "hub"
        | "communications_institutionnelles"
        | "photo_enfant"
      household_role:
        | "parent"
        | "beau_parent"
        | "grand_parent"
        | "autre_referent"
      hub_kind: "ecole" | "club" | "quartier" | "conservatoire" | "autre"
      hub_status: "solo" | "active" | "structured"
      moove_movement:
        | "gain"
        | "usage"
        | "ajustement"
        | "fonds_solidarite"
        | "solde_initial"
      report_status: "ouvert" | "en_cours" | "resolu" | "clos"
      trip_direction: "aller" | "retour"
      trip_request_status:
        | "en_attente"
        | "accepte"
        | "refuse"
        | "annule"
        | "expire"
      trip_status:
        | "couvert"
        | "couvert_ouvert"
        | "partiellement_couvert"
        | "conditionnel"
        | "non_couvert"
        | "annule"
      volunteer_vector: "club" | "po_ecole" | "commune" | "association_parents"
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
      channel_type: ["cercle_intime", "hub", "broadcast_institutionnel"],
      consent_type: [
        "inscription",
        "cercle_intime",
        "hub",
        "communications_institutionnelles",
        "photo_enfant",
      ],
      household_role: [
        "parent",
        "beau_parent",
        "grand_parent",
        "autre_referent",
      ],
      hub_kind: ["ecole", "club", "quartier", "conservatoire", "autre"],
      hub_status: ["solo", "active", "structured"],
      moove_movement: [
        "gain",
        "usage",
        "ajustement",
        "fonds_solidarite",
        "solde_initial",
      ],
      report_status: ["ouvert", "en_cours", "resolu", "clos"],
      trip_direction: ["aller", "retour"],
      trip_request_status: [
        "en_attente",
        "accepte",
        "refuse",
        "annule",
        "expire",
      ],
      trip_status: [
        "couvert",
        "couvert_ouvert",
        "partiellement_couvert",
        "conditionnel",
        "non_couvert",
        "annule",
      ],
      volunteer_vector: ["club", "po_ecole", "commune", "association_parents"],
    },
  },
} as const
