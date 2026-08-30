// Generado desde el esquema real de Supabase (project ref: arzadwxsifnaolvfcvqk)
// via mcp generate_typescript_types. No editar a mano: si el esquema cambia,
// regenerar con la misma herramienta.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      clientes: {
        Row: {
          created_at: string;
          datos_extra: Json | null;
          direccion: string | null;
          id: string;
          nombre: string;
          notas: string | null;
          numero_cliente: number;
          ruc: string | null;
          telefono: string | null;
          tipo_cliente: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          datos_extra?: Json | null;
          direccion?: string | null;
          id?: string;
          nombre: string;
          notas?: string | null;
          numero_cliente?: never;
          ruc?: string | null;
          telefono?: string | null;
          tipo_cliente?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          datos_extra?: Json | null;
          direccion?: string | null;
          id?: string;
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

export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
export type ClienteUpdate = Database["public"]["Tables"]["clientes"]["Update"];
export type TipoCliente = "mayorista" | "detal";
