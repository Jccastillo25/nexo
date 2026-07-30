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
      accessories: {
        Row: {
          company_id: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          company_id: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          company_id: string
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          max_drivers: number | null
          max_users: number | null
          name: string
          phone: string | null
          ruc: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_drivers?: number | null
          max_users?: number | null
          name: string
          phone?: string | null
          ruc?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_drivers?: number | null
          max_users?: number | null
          name?: string
          phone?: string | null
          ruc?: string | null
        }
        Relationships: []
      }
      driver_license_categories: {
        Row: {
          category_id: string
          driver_id: string
        }
        Insert: {
          category_id: string
          driver_id: string
        }
        Update: {
          category_id?: string
          driver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_license_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "license_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_license_categories_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          company_id: string
          created_at: string | null
          email: string
          first_name: string
          full_name: string
          id: string
          is_active: boolean
          last_name: string
          license_expiry: string
          license_number: string | null
          license_type: string | null
          national_id: string
          pin_code: string
          username: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          email: string
          first_name: string
          full_name: string
          id: string
          is_active?: boolean
          last_name: string
          license_expiry: string
          license_number?: string | null
          license_type?: string | null
          national_id: string
          pin_code: string
          username: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          email?: string
          first_name?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          license_expiry?: string
          license_number?: string | null
          license_type?: string | null
          national_id?: string
          pin_code?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      license_categories: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          copyright_text: string | null
          id: number
          logo_url: string | null
          product_name: string
          updated_at: string | null
        }
        Insert: {
          copyright_text?: string | null
          id?: number
          logo_url?: string | null
          product_name?: string
          updated_at?: string | null
        }
        Update: {
          copyright_text?: string | null
          id?: number
          logo_url?: string | null
          product_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trip_events: {
        Row: {
          event_type: Database["public"]["Enums"]["trip_event_type"]
          gps_accuracy: number | null
          id: string
          latitude: number | null
          longitude: number | null
          recorded_at: string | null
          synced_offline: boolean | null
          trip_id: string
        }
        Insert: {
          event_type: Database["public"]["Enums"]["trip_event_type"]
          gps_accuracy?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          recorded_at?: string | null
          synced_offline?: boolean | null
          trip_id: string
        }
        Update: {
          event_type?: Database["public"]["Enums"]["trip_event_type"]
          gps_accuracy?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          recorded_at?: string | null
          synced_offline?: boolean | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_inspections: {
        Row: {
          accessory_id: string
          created_at: string | null
          has_damage: boolean
          id: string
          is_present: boolean
          issue_description: string | null
          issue_photo_url: string | null
          trip_id: string
        }
        Insert: {
          accessory_id: string
          created_at?: string | null
          has_damage?: boolean
          id?: string
          is_present?: boolean
          issue_description?: string | null
          issue_photo_url?: string | null
          trip_id: string
        }
        Update: {
          accessory_id?: string
          created_at?: string | null
          has_damage?: boolean
          id?: string
          is_present?: boolean
          issue_description?: string | null
          issue_photo_url?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_inspections_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_inspections_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string | null
          driver_id: string
          end_odometer: number | null
          end_odometer_photo_url: string | null
          id: string
          start_odometer: number
          start_odometer_photo_url: string
          status: Database["public"]["Enums"]["trip_status"]
          vehicle_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          driver_id: string
          end_odometer?: number | null
          end_odometer_photo_url?: string | null
          id?: string
          start_odometer: number
          start_odometer_photo_url: string
          status?: Database["public"]["Enums"]["trip_status"]
          vehicle_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          driver_id?: string
          end_odometer?: number | null
          end_odometer_photo_url?: string | null
          id?: string
          start_odometer?: number
          start_odometer_photo_url?: string
          status?: Database["public"]["Enums"]["trip_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_accessories: {
        Row: {
          accessory_id: string
          vehicle_id: string
        }
        Insert: {
          accessory_id: string
          vehicle_id: string
        }
        Update: {
          accessory_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_accessories_accessory_id_fkey"
            columns: ["accessory_id"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_accessories_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          company_id: string
          created_at: string | null
          current_odometer: number
          id: string
          license_plate: string
          model: string | null
          status: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Insert: {
          brand?: string | null
          company_id: string
          created_at?: string | null
          current_odometer?: number
          id?: string
          license_plate: string
          model?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Update: {
          brand?: string | null
          company_id?: string
          created_at?: string | null
          current_odometer?: number
          id?: string
          license_plate?: string
          model?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_company_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      trip_event_type:
        | "start_trip"
        | "arrival_destination"
        | "start_unloading"
        | "end_unloading"
        | "finish_trip"
      trip_status:
        | "created"
        | "inspected"
        | "in_transit"
        | "at_destination"
        | "unloading"
        | "unloading_completed"
        | "completed"
        | "cancelled"
      user_role: "admin" | "driver"
      vehicle_status: "active" | "maintenance" | "inactive"
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
      trip_event_type: [
        "start_trip",
        "arrival_destination",
        "start_unloading",
        "end_unloading",
        "finish_trip",
      ],
      trip_status: [
        "created",
        "inspected",
        "in_transit",
        "at_destination",
        "unloading",
        "unloading_completed",
        "completed",
        "cancelled",
      ],
      user_role: ["admin", "driver"],
      vehicle_status: ["active", "maintenance", "inactive"],
    },
  },
} as const
