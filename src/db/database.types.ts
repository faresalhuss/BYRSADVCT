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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          added_at: string
          email: string
        }
        Insert: {
          added_at?: string
          email: string
        }
        Update: {
          added_at?: string
          email?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          bytes: number
          created_at: string
          created_by: string | null
          deal_id: string | null
          inquiry_id: string | null
          height: number | null
          id: string
          kind: string
          mime: string
          original_name: string | null
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        Insert: {
          bytes: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          inquiry_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime: string
          original_name?: string | null
          storage_path: string
          thumb_path?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          inquiry_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime?: string
          original_name?: string | null
          storage_path?: string
          thumb_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmarks: {
        Row: {
          created_at: string
          id: string
          vehicle: string
          kind: string
          note: string | null
          observed_on: string
          price_cents: number
          source: string
          total_srp_cents: number | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          vehicle?: string
          kind: string
          note?: string | null
          observed_on: string
          price_cents: number
          source: string
          total_srp_cents?: number | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          vehicle?: string
          kind?: string
          note?: string | null
          observed_on?: string
          price_cents?: number
          source?: string
          total_srp_cents?: number | null
          url?: string | null
        }
        Relationships: []
      }
      deal_notes: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          occurred_at: string
          who: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          occurred_at?: string
          who?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          occurred_at?: string
          who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          note: string | null
          offer: Json
          revision_no: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          note?: string | null
          offer: Json
          revision_no: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          note?: string | null
          offer?: Json
          revision_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_revisions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          dealership_address: string | null
          dealership_name: string
          dealership_phone: string | null
          dealership_website: string | null
          decoded: Json | null
          id: string
          quote_expires_on: string | null
          salesperson: string | null
          status: string
          sticker: Json
          updated_at: string
          vehicle: Json
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          dealership_address?: string | null
          dealership_name: string
          dealership_phone?: string | null
          dealership_website?: string | null
          decoded?: Json | null
          id?: string
          quote_expires_on?: string | null
          salesperson?: string | null
          status?: string
          sticker?: Json
          updated_at?: string
          vehicle?: Json
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          dealership_address?: string | null
          dealership_name?: string
          dealership_phone?: string | null
          dealership_website?: string | null
          decoded?: Json | null
          id?: string
          quote_expires_on?: string | null
          salesperson?: string | null
          status?: string
          sticker?: Json
          updated_at?: string
          vehicle?: Json
        }
        Relationships: []
      }
      drafts: {
        Row: {
          key: string
          payload: Json
          updated_at: string
        }
        Insert: {
          key: string
          payload: Json
          updated_at?: string
        }
        Update: {
          key?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          address_line: string | null
          advertised_price_cents: number | null
          city: string | null
          converted_deal_id: string | null
          created_at: string
          created_by: string | null
          dealership_name: string
          id: string
          listing_url: string | null
          msrp_cents: number | null
          notes: string | null
          phone: string | null
          salesperson: string | null
          state: string | null
          status: string
          updated_at: string
          vehicle: Json
          website: string | null
          zip: string | null
        }
        Insert: {
          address_line?: string | null
          advertised_price_cents?: number | null
          city?: string | null
          converted_deal_id?: string | null
          created_at?: string
          created_by?: string | null
          dealership_name: string
          id?: string
          listing_url?: string | null
          msrp_cents?: number | null
          notes?: string | null
          phone?: string | null
          salesperson?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          vehicle?: Json
          website?: string | null
          zip?: string | null
        }
        Update: {
          address_line?: string | null
          advertised_price_cents?: number | null
          city?: string | null
          converted_deal_id?: string | null
          created_at?: string
          created_by?: string | null
          dealership_name?: string
          id?: string
          listing_url?: string | null
          msrp_cents?: number | null
          notes?: string | null
          phone?: string | null
          salesperson?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          vehicle?: Json
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      outside_offers: {
        Row: {
          cents: number
          contingent_on_inspection: boolean
          created_at: string
          expires_on: string | null
          id: string
          note: string | null
          source: string
        }
        Insert: {
          cents: number
          contingent_on_inspection?: boolean
          created_at?: string
          expires_on?: string | null
          id?: string
          note?: string | null
          source: string
        }
        Update: {
          cents?: number
          contingent_on_inspection?: boolean
          created_at?: string
          expires_on?: string | null
          id?: string
          note?: string | null
          source?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: number
          payload: Json
          updated_at: string
        }
        Insert: {
          id?: number
          payload: Json
          updated_at?: string
        }
        Update: {
          id?: number
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      tax_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          payload: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          payload: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      trade_profile: {
        Row: {
          id: number
          payload: Json
          updated_at: string
        }
        Insert: {
          id?: number
          payload?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_allowed: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const
