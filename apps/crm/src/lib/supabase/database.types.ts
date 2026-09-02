// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh).
//
// `public` viene del generador real
// (generate_typescript_types/`supabase gen types typescript`, regenerado
// 2026-09-02) — incluye `has_permission`, `get_platform_settings`,
// `get_visible_apps`, `update_platform_settings` y, agregados en esta
// misma pasada, los wrappers de RRHH `registrar_marca_kiosko` y
// `set_pin_empleado` (supabase/migrations/20260902000006_rrhh_schema_and_tables.sql).
//
// `crm`, `core` y `rrhh` estan escritos a mano porque esos schemas
// todavia no estan expuestos en la API de Supabase (Settings > API >
// Data API > Exposed schemas: solo `public` hoy) —
// `generate_typescript_types` introspecciona via esa API expuesta, no
// via conexion directa a Postgres, asi que no puede ver tablas de un
// schema no expuesto. `core` en particular esta sin exponer **a
// proposito** (decision de seguridad documentada en docs/DATABASE.md,
// para no exponer tablas como `user_permissions` cruda a la API REST) —
// no se expone solo para poder generar tipos.
//
// El bloque `core` cubre unicamente las tablas tocadas por
// 20260902000001_app_scoped_roles.sql y
// 20260902000002_partition_core_audit_log.sql (RBAC de 3 capas +
// particionamiento) — no el resto de `core`. El bloque `rrhh` cubre las 6
// tablas de 20260902000006_rrhh_schema_and_tables.sql (Expedientes,
// Asistencia/kiosko, Planillas). Ver
// docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2 y §3.
//
// Cuando se expongan `crm`/`core`/`rrhh`, regenerar con la herramienta y
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
      registrar_marca_kiosko: {
        Args: { p_kiosko_id: string; p_pin: string };
        Returns: {
          empleado_nombre: string;
          marcado_en: string;
          tipo: string;
        }[];
      };
      set_pin_empleado: {
        Args: { p_company_id: string; p_empleado_id: string; p_pin: string };
        Returns: undefined;
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
  rrhh: {
    Tables: {
      empleados: {
        Row: {
          id: string;
          company_id: string;
          codigo_empleado: number;
          nombre: string;
          apellido: string;
          documento_identidad: string | null;
          email: string | null;
          telefono: string | null;
          puesto: string | null;
          departamento: string | null;
          fecha_ingreso: string;
          fecha_baja: string | null;
          estado: "activo" | "inactivo" | "baja";
          // Hash bcrypt, nunca el PIN en texto plano — jamas escribir
          // este campo directo desde la app, usar el RPC set_pin_empleado.
          pin_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string; // tiene DEFAULT rrhh.default_company_id()
          codigo_empleado?: never; // generated always as identity
          nombre: string;
          apellido: string;
          documento_identidad?: string | null;
          email?: string | null;
          telefono?: string | null;
          puesto?: string | null;
          departamento?: string | null;
          fecha_ingreso?: string;
          fecha_baja?: string | null;
          estado?: "activo" | "inactivo" | "baja";
          pin_hash?: never; // nunca via Insert directo, usar RPC set_pin_empleado
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          codigo_empleado?: never;
          nombre?: string;
          apellido?: string;
          documento_identidad?: string | null;
          email?: string | null;
          telefono?: string | null;
          puesto?: string | null;
          departamento?: string | null;
          fecha_ingreso?: string;
          fecha_baja?: string | null;
          estado?: "activo" | "inactivo" | "baja";
          pin_hash?: never;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Tabla separada de empleados a proposito — compensacion.ver/editar
      // es un permiso distinto de empleados.ver, ver comentario en la
      // migracion 20260902000006.
      empleado_compensacion: {
        Row: {
          empleado_id: string;
          company_id: string;
          salario_base: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          empleado_id: string;
          company_id: string;
          salario_base?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          empleado_id?: string;
          company_id?: string;
          salario_base?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      kiosko_dispositivos: {
        Row: {
          id: string;
          company_id: string;
          nombre: string;
          ubicacion: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          nombre: string;
          ubicacion?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          nombre?: string;
          ubicacion?: string | null;
          activo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Particionada por rango mensual desde 2026-09-02 (ver
      // 20260902000006_rrhh_schema_and_tables.sql) — no cambia la forma
      // de Row/Insert/Update, solo como Postgres almacena las filas.
      // Las marcas de origen "kiosko" se insertan via el RPC
      // registrar_marca_kiosko (security definer), no via Insert directo.
      asistencia_marcas: {
        Row: {
          id: string;
          company_id: string;
          empleado_id: string;
          kiosko_id: string | null;
          tipo: "entrada" | "salida";
          origen: "kiosko" | "manual";
          creado_por: string | null;
          marcado_en: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          empleado_id: string;
          kiosko_id?: string | null;
          tipo: "entrada" | "salida";
          origen?: "kiosko" | "manual";
          creado_por?: string | null;
          marcado_en?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          empleado_id?: string;
          kiosko_id?: string | null;
          tipo?: "entrada" | "salida";
          origen?: "kiosko" | "manual";
          creado_por?: string | null;
          marcado_en?: string;
        };
        Relationships: [];
      };
      // NO particionada (volumen acotado: una fila por corrida de
      // nomina) — ver criterio de particionamiento en
      // docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2.1. Transicion
      // borrador->aprobada via una funcion security definer futura
      // (core.fn_aprobar_planilla), no via Update directo.
      planillas: {
        Row: {
          id: string;
          company_id: string;
          periodo_inicio: string;
          periodo_fin: string;
          estado: "borrador" | "aprobada" | "anulada";
          total: number;
          generada_por: string | null;
          generada_en: string;
          aprobada_por: string | null;
          aprobada_en: string | null;
          anulada_por: string | null;
          anulada_en: string | null;
          asiento_contable_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          periodo_inicio: string;
          periodo_fin: string;
          estado?: "borrador" | "aprobada" | "anulada";
          total?: number;
          generada_por?: string | null;
          generada_en?: string;
          aprobada_por?: string | null;
          aprobada_en?: string | null;
          anulada_por?: string | null;
          anulada_en?: string | null;
          asiento_contable_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          periodo_inicio?: string;
          periodo_fin?: string;
          estado?: "borrador" | "aprobada" | "anulada";
          total?: number;
          generada_por?: string | null;
          aprobada_por?: string | null;
          aprobada_en?: string | null;
          anulada_por?: string | null;
          anulada_en?: string | null;
          asiento_contable_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      planilla_detalles: {
        Row: {
          id: string;
          planilla_id: string;
          empleado_id: string;
          company_id: string;
          salario_base: number;
          horas_extra: number;
          bonos: number;
          deducciones: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          planilla_id: string;
          empleado_id: string;
          company_id: string;
          salario_base?: number;
          horas_extra?: number;
          bonos?: number;
          deducciones?: number;
          total?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          planilla_id?: string;
          empleado_id?: string;
          company_id?: string;
          salario_base?: number;
          horas_extra?: number;
          bonos?: number;
          deducciones?: number;
          total?: number;
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

export type Empleado = Database["rrhh"]["Tables"]["empleados"]["Row"];
export type EmpleadoInsert = Database["rrhh"]["Tables"]["empleados"]["Insert"];
export type EmpleadoUpdate = Database["rrhh"]["Tables"]["empleados"]["Update"];
export type EmpleadoCompensacion = Database["rrhh"]["Tables"]["empleado_compensacion"]["Row"];
export type KioskoDispositivo = Database["rrhh"]["Tables"]["kiosko_dispositivos"]["Row"];
export type AsistenciaMarca = Database["rrhh"]["Tables"]["asistencia_marcas"]["Row"];
export type Planilla = Database["rrhh"]["Tables"]["planillas"]["Row"];
export type PlanillaDetalle = Database["rrhh"]["Tables"]["planilla_detalles"]["Row"];
export type EstadoEmpleado = "activo" | "inactivo" | "baja";
export type EstadoPlanilla = "borrador" | "aprobada" | "anulada";
