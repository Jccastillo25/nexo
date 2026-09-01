// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh).
//
// `crm` esta escrito a mano porque ese schema todavia no esta expuesto en
// la API de Supabase (Settings > API > Data API > Exposed schemas) — hasta
// que se agregue "crm" ahi, `generate_typescript_types` no puede
// introspectarlo (solo ve "public"). `public` (con el RPC has_permission)
// SI viene del generador real. Ver docs/DATABASE.md y .env.local.example.
//
// Cuando se exponga "crm", regenerar con la herramienta y reemplazar el
// bloque `crm` de abajo por el real.

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
      get_platform_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          logo_url: string | null;
          login_background_url: string | null;
          eyebrow_text: string;
          heading_text: string;
          tagline: string;
          bullets: Json;
          copyright_text: string;
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
  crm: {
    Tables: {
      clientes: {
        Row: {
          id: string;
          company_id: string;
          created_at: string;
          datos_extra: Json | null;
          direccion: string | null;
          nombre: string;
          notas: string | null;
          numero_cliente: number;
          ruc: string | null;
          telefono: string | null;
          tipo_cliente: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string; // tiene DEFAULT crm.default_company_id()
          created_at?: string;
          datos_extra?: Json | null;
          direccion?: string | null;
          nombre: string;
          notas?: string | null;
          numero_cliente?: never; // generated always as identity
          ruc?: string | null;
          telefono?: string | null;
          tipo_cliente?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          created_at?: string;
          datos_extra?: Json | null;
          direccion?: string | null;
          nombre?: string;
          notas?: string | null;
          numero_cliente?: never;
          ruc?: string | null;
          telefono?: string | null;
          tipo_cliente?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Cliente = Database["crm"]["Tables"]["clientes"]["Row"];
export type ClienteInsert = Database["crm"]["Tables"]["clientes"]["Insert"];
export type ClienteUpdate = Database["crm"]["Tables"]["clientes"]["Update"];
export type TipoCliente = "mayorista" | "detal";
