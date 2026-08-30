// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh), schema public.
// Igual que en apps/crm: escrito a mano porque el generador de tipos del
// MCP solo introspecta "public" (no sigue el toggle de "Exposed schemas"
// del dashboard). Ver docs/DATABASE.md.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_permission: {
        Args: { p_code: string; p_company_id: string };
        Returns: boolean;
      };
      get_visible_apps: {
        Args: { p_company_id: string };
        Returns: {
          slug: string;
          name: string;
          category: string | null;
          icon: string | null;
          color: string | null;
          route: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type VisibleApp =
  Database["public"]["Functions"]["get_visible_apps"]["Returns"][number];
