// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh) — MISMO proyecto
// que apps/crm/src/lib/supabase/database.types.ts. Es una copia exacta,
// no un import cruzado: los apps de este monorepo no se importan entre si
// directamente (cada uno es su propio deploy de Vercel), y
// packages/types todavia es un stub vacio (ver su comentario) — unificar
// esto ahi es trabajo de una fase posterior, no de este cambio. Mantener
// sincronizado a mano con el archivo de apps/crm cuando cambie el schema
// compartido (core/public); las secciones `rrhh` son las que de verdad
// le pertenecen a esta app.
//
// `public` viene del generador real
// (generate_typescript_types/`supabase gen types typescript`, regenerado
// 2026-09-02) — incluye `has_permission`, `get_platform_settings`,
// `get_visible_apps`, `update_platform_settings`, `registrar_marca_kiosko`,
// `set_pin_empleado`, `validar_acceso_operativo` y `crear_empleado`.
//
// `crm`, `core` y `rrhh` estan escritos a mano porque esos schemas
// todavia no estan expuestos en la API de Supabase (Settings > API >
// Data API > Exposed schemas: solo `public`/`crm` hoy, `rrhh` pendiente —
// ver .env.local.example) — `generate_typescript_types` introspecciona
// via esa API expuesta, no via conexion directa a Postgres, asi que no
// puede ver tablas de un schema no expuesto. `core` esta sin exponer **a
// proposito** (decision de seguridad, docs/DATABASE.md).
//
// El bloque `rrhh` cubre las 6 tablas de
// 20260902000006_rrhh_schema_and_tables.sql (Expedientes, Asistencia/
// kiosko, Planillas) mas lo agregado por
// 20260902000008_rrhh_nicaragua_and_contracts.sql: columnas nuevas en
// `empleados`/`empleado_compensacion` y las tablas `parametros_ley` y
// `seguridad_accesos`. Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2
// y §3.

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
        // Sin empleado_nombre a proposito desde 2026-09-05 (regla
        // obligatoria del kiosko anonimo: no revelar datos personales) —
        // ver supabase/migrations/20260905000002_kiosko_minimize_exposure_and_bloqueo_check.sql
        Returns: {
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
          // o crear_empleado. Doble proposito: marcacion fisica
          // (registrar_marca_kiosko) Y login al modulo movil
          // (validar_acceso_operativo) — es el mismo PIN.
          pin_hash: string | null;
          nombre_usuario: string; // unico por company_id, autogenerado por crear_empleado o editable a mano
          pin_bloqueado: boolean; // true a los 3 intentos fallidos consecutivos, ver rrhh.fn_validar_acceso_operativo
          intentos_fallidos: number;
          user_id: string | null; // auth.users.id vinculado — null hasta que se provisiona la cuenta
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
          pin_hash?: never; // nunca via Insert directo, usar RPC
          nombre_usuario: string;
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
          pin_bloqueado?: boolean; // via Update directo: camino de desbloqueo, protegido por la policy de empleados.editar
          intentos_fallidos?: number;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      empleado_compensacion: {
        Row: {
          empleado_id: string;
          company_id: string;
          salario_base: number;
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
      // Particionada por rango mensual desde el dia 1 — no cambia la
      // forma de Row/Insert/Update. Las marcas de origen "kiosko" se
      // insertan via el RPC registrar_marca_kiosko (security definer).
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
      // nomina). Transicion borrador->aprobada via una funcion security
      // definer futura (core.fn_aprobar_planilla), no via Update directo.
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
      // Versionada por vigente_desde/vigente_hasta — nunca se
      // sobreescribe un valor historico. Solo una fila "activa"
      // (vigente_hasta null) por codigo por empresa.
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
          company_id?: string;
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
      // Particionada por rango mensual desde el dia 1. Solo intentos
      // FALLIDOS, insertados por rrhh.fn_validar_acceso_operativo
      // (security definer) — sin policy de RLS para authenticated
      // (deny-by-default, mismo criterio que core.audit_log).
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
