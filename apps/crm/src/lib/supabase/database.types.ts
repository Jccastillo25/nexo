// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh).
//
// `public` viene del generador real
// (generate_typescript_types/`supabase gen types typescript`, regenerado
// 2026-09-02) — incluye `has_permission`, `get_platform_settings`,
// `get_visible_apps`, `update_platform_settings`, los wrappers de RRHH
// `registrar_marca_kiosko` y `set_pin_empleado`
// (supabase/migrations/20260902000006_rrhh_schema_and_tables.sql) y,
// agregados en esta misma pasada, `validar_acceso_operativo` y
// `crear_empleado`
// (supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql).
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
// Asistencia/kiosko, Planillas) mas lo agregado por
// 20260902000008_rrhh_nicaragua_and_contracts.sql: columnas nuevas en
// `empleados`/`empleado_compensacion` y las tablas `parametros_ley` y
// `seguridad_accesos`. Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2
// y §3.
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
      validar_acceso_operativo: {
        Args: { p_nombre_usuario: string; p_pin: string };
        Returns: string;
      };
      crear_empleado: {
        Args: {
          p_apellido: string;
          p_company_id: string;
          p_departamento?: string;
          p_documento_identidad?: string;
          p_email?: string;
          p_fecha_ingreso?: string;
          p_modalidad_contrato?: string;
          p_nombre: string;
          p_nombre_usuario?: string;
          p_pin?: string;
          p_puesto?: string;
          p_salario_base?: number;
          p_telefono?: string;
        };
        Returns: {
          empleado_id: string;
          nombre_usuario: string;
          pin_kiosko: string;
        }[];
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
      // Nullable en logo_url/login_background_url (no en HEAD original de
      // esta sesion) — version de origin/main, mas reciente y correcta:
      // ver e19302a "login completamente editable" y 44b6ab6 "fix: subir
      // logo/fondo en /ajustes tiraba la pagina entera", que existia
      // justamente porque el campo puede no tener imagen todavia.
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
          // este campo directo desde la app, usar el RPC set_pin_empleado
          // o crear_empleado. Desde 20260902000008 tiene doble proposito:
          // marcacion fisica (registrar_marca_kiosko) Y login al modulo
          // movil (validar_acceso_operativo) — es el mismo PIN.
          pin_hash: string | null;
          // Agregado en 20260902000008 — credenciales/estado de acceso
          // operativo del modulo movil de choferes.
          nombre_usuario: string; // unico por company_id, autogenerado por crear_empleado o editable a mano
          pin_bloqueado: boolean; // true a los 3 intentos fallidos consecutivos, ver rrhh.fn_validar_acceso_operativo
          intentos_fallidos: number;
          user_id: string | null; // auth.users.id vinculado — null hasta que se provisiona la cuenta (ver nota Next.js en la migracion)
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
          pin_hash?: never; // nunca via Insert directo, usar RPC set_pin_empleado o crear_empleado
          nombre_usuario: string; // NOT NULL — en la practica siempre via RPC crear_empleado, no Insert directo
          pin_bloqueado?: boolean;
          intentos_fallidos?: number;
          user_id?: string | null;
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
          nombre_usuario?: string;
          pin_bloqueado?: boolean; // via Update directo: es el camino de desbloqueo, protegido por la policy de empleados.editar
          intentos_fallidos?: number;
          user_id?: string | null;
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
          // Agregado en 20260902000008 — gobierna como el motor de
          // planillas interpreta salario_base/comisiones para este
          // empleado.
          modalidad_contrato: "nomina_estandar" | "comisionista_destajo";
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          empleado_id: string;
          company_id: string;
          salario_base?: number;
          modalidad_contrato?: "nomina_estandar" | "comisionista_destajo";
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          empleado_id?: string;
          company_id?: string;
          salario_base?: number;
          modalidad_contrato?: "nomina_estandar" | "comisionista_destajo";
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
      // Agregada en 20260902000008. Versionada por vigente_desde/
      // vigente_hasta — nunca se sobreescribe un valor historico. Solo
      // una fila "activa" (vigente_hasta null) por codigo por empresa.
      parametros_ley: {
        Row: {
          id: string;
          company_id: string;
          codigo: string; // 'inss_laboral' | 'inss_patronal' | 'inatec' | 'techo_inss'
          unidad: "porcentaje" | "monto";
          valor: number;
          vigente_desde: string;
          vigente_hasta: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string; // tiene DEFAULT rrhh.default_company_id()
          codigo: string;
          unidad: "porcentaje" | "monto";
          valor: number;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          codigo?: string;
          unidad?: "porcentaje" | "monto";
          valor?: number;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      // Agregada en 20260902000008. Particionada por rango mensual desde
      // el dia 1 — no cambia la forma de Row/Insert/Update. Solo
      // intentos FALLIDOS, insertados por rrhh.fn_validar_acceso_operativo
      // (security definer) — sin policy de RLS para authenticated
      // (deny-by-default, mismo criterio que core.audit_log), por eso en
      // la practica esta tabla no se lee ni escribe via el cliente normal
      // desde la app, solo referencia de forma para consultas admin.
      seguridad_accesos: {
        Row: {
          id: string;
          company_id: string;
          nombre_usuario: string;
          empleado_id: string | null;
          exitoso: boolean;
          ip_origen: string | null;
          intentado_en: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          nombre_usuario: string;
          empleado_id?: string | null;
          exitoso?: boolean;
          ip_origen?: string | null;
          intentado_en?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          nombre_usuario?: string;
          empleado_id?: string | null;
          exitoso?: boolean;
          ip_origen?: string | null;
          intentado_en?: string;
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
export type ParametroLey = Database["rrhh"]["Tables"]["parametros_ley"]["Row"];
export type SeguridadAcceso = Database["rrhh"]["Tables"]["seguridad_accesos"]["Row"];
export type EstadoEmpleado = "activo" | "inactivo" | "baja";
export type EstadoPlanilla = "borrador" | "aprobada" | "anulada";
export type ModalidadContrato = "nomina_estandar" | "comisionista_destajo";
