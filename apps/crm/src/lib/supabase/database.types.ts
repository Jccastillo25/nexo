// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh).
//
// `public` viene del generador real
// (generate_typescript_types/`supabase gen types typescript`, regenerado
// 2026-09-02) — incluye ademas de `has_permission` los RPC
// `get_platform_settings`/`get_visible_apps`/`update_platform_settings`
// que se agregaron en migraciones posteriores a la primera version de
// este archivo y nunca se habian vuelto a generar (deuda ya pagada en
// este mismo cambio).
//
// `crm` y `core` estan escritos a mano porque esos schemas todavia no
// estan expuestos en la API de Supabase (Settings > API > Data API >
// Exposed schemas: solo `public` hoy) — `generate_typescript_types`
// introspecciona via esa API expuesta, no via conexion directa a
// Postgres, asi que no puede ver tablas de un schema no expuesto. `core`
// en particular esta sin exponer **a proposito** (decision de seguridad
// documentada en docs/DATABASE.md, para no exponer tablas como
// `user_permissions` cruda a la API REST) — no se expone solo para poder
// generar tipos.
//
// El bloque `core` de abajo cubre unicamente las tablas tocadas por
// supabase/migrations/20260902000001_app_scoped_roles.sql y
// 20260902000002_partition_core_audit_log.sql (RBAC de 3 capas +
// particionamiento) — no el resto de `core` (companies, apps,
// permissions_catalog, etc.), que no cambio en este commit. Ver
// docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §3 y §2.
//
// Cuando se exponga `crm`/`core`, regenerar con la herramienta y
// reemplazar los bloques de abajo por los reales.

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
      get_platform_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          bullets: Json;
          copyright_text: string;
          eyebrow_text: string;
          heading_text: string;
          login_background_url: string;
          logo_url: string;
          tagline: string;
        }[];
      };
      get_visible_apps: {
        Args: { p_company_id: string };
        Returns: {
          category: string;
          color: string;
          icon: string;
          name: string;
          route: string;
          slug: string;
        }[];
      };
      has_permission: {
        Args: { p_code: string; p_company_id: string };
        Returns: boolean;
      };
      update_platform_settings: {
        Args: {
          p_bullets?: Json;
          p_copyright_text?: string;
          p_eyebrow_text?: string;
          p_heading_text?: string;
          p_login_background_url?: string;
          p_logo_url?: string;
          p_tagline?: string;
        };
        Returns: undefined;
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
  core: {
    Tables: {
      app_roles: {
        Row: {
          id: string;
          module_slug: string;
          role_key: string;
          label: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_slug: string;
          role_key: string;
          label: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_slug?: string;
          role_key?: string;
          label?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      app_role_permissions: {
        Row: {
          app_role_id: string;
          permission_code: string;
        };
        Insert: {
          app_role_id: string;
          permission_code: string;
        };
        Update: {
          app_role_id?: string;
          permission_code?: string;
        };
        Relationships: [];
      };
      user_app_roles: {
        Row: {
          user_id: string;
          company_id: string;
          app_role_id: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          company_id: string;
          app_role_id: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          company_id?: string;
          app_role_id?: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Relationships: [];
      };
      // Particionada por rango mensual desde 2026-09-02 (ver
      // supabase/migrations/20260902000002_partition_core_audit_log.sql)
      // — el particionamiento no cambia la forma de Row/Insert/Update,
      // solo como Postgres almacena las filas fisicamente.
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          company_id: string | null;
          action: string;
          entity: string | null;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          company_id?: string | null;
          action: string;
          entity?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          company_id?: string | null;
          action?: string;
          entity?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
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

export type AppRole = Database["core"]["Tables"]["app_roles"]["Row"];
export type UserAppRole = Database["core"]["Tables"]["user_app_roles"]["Row"];
export type AuditLogEntry = Database["core"]["Tables"]["audit_log"]["Row"];
