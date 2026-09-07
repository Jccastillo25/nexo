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
      // F1.3 (2026-09-07): ciclo de vida de la credencial — ver
      // supabase/migrations/20260907154715_f1_3_pin_exclusivamente_contractual.sql.
      // activar_contrato ahora genera el PIN (cambio de firma de retorno
      // respecto a F1.2 -- requirio DROP + CREATE, no CREATE OR REPLACE).
      activar_contrato: {
        Args: { p_company_id: string; p_contrato_id: string };
        Returns: { pin_kiosko: string }[];
      };
      regenerar_pin_contrato: {
        Args: { p_company_id: string; p_contrato_id: string };
        Returns: { pin_kiosko: string }[];
      };
      // "ver" = exclusivamente estado -- nunca selecciona pin_hash.
      estado_credencial_contrato: {
        Args: { p_company_id: string; p_contrato_id: string };
        Returns: {
          tiene_credencial: boolean;
          activo: boolean;
          pin_bloqueado: boolean;
          rotacion_numero: number;
        }[];
      };
      crear_contrato: {
        Args: {
          p_company_id: string;
          p_departamento?: string;
          p_empleado_id: string;
          p_fecha_fin_prevista?: string;
          p_fecha_inicio?: string;
          p_modalidad_contrato?: string;
          p_puesto?: string;
          p_salario_base?: number;
        };
        Returns: {
          contrato_id: string;
          numero_contrato: number;
        }[];
      };
      editar_contrato: {
        Args: {
          p_company_id: string;
          p_contrato_id: string;
          p_departamento?: string;
          p_fecha_fin_prevista?: string;
          p_fecha_inicio?: string;
          p_modalidad_contrato?: string;
          p_puesto?: string;
          p_salario_base?: number;
        };
        Returns: undefined;
      };
      finalizar_contrato: {
        Args: { p_company_id: string; p_contrato_id: string };
        Returns: undefined;
      };
      // F1.1 (2026-09-07): firma reducida a solo Expediente General — ver
      // supabase/migrations/20260907152301_f1_1_separar_expediente_general_laboral.sql.
      // La firma anterior (13 parametros, generaba PIN/nombre_usuario) fue
      // DROPeada, no reemplazada in place (Postgres distingue funciones
      // por firma).
      crear_empleado: {
        Args: {
          p_apellido: string;
          p_company_id: string;
          p_documento_identidad?: string;
          p_email?: string;
          p_nombre: string;
          p_telefono?: string;
        };
        Returns: {
          empleado_id: string;
          codigo_empleado: number;
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
      // F1.4 (2026-09-07) — ver
      // supabase/migrations/20260907163244_f1_4_rrhh_jornadas_minimas.sql.
      // Unico camino de escritura de rrhh.contrato_jornadas -- cierra la
      // vigencia abierta anterior y abre una nueva, atomicamente.
      asignar_jornada_contrato: {
        Args: {
          p_company_id: string;
          p_contrato_id: string;
          p_jornada_id: string;
          p_vigente_desde?: string;
        };
        Returns: {
          contrato_jornada_id: string;
          vigente_desde: string;
        }[];
      };
      // Interfaz de solo lectura para F1.5 -- resuelve contrato+fecha ->
      // jornada+regla del dia. No implementa consolidacion/calculo.
      jornada_vigente_contrato: {
        Args: { p_company_id: string; p_contrato_id: string; p_fecha?: string };
        Returns: {
          jornada_id: string;
          jornada_nombre: string;
          dia_semana: number;
          laborable: boolean;
          hora_entrada: string | null;
          hora_salida: string | null;
          minutos_descanso: number;
          tolerancia_entrada_min: number;
          tolerancia_salida_min: number;
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
  rrhh: {
    Tables: {
      // F1.1 (2026-09-07): puesto/departamento/fecha_ingreso/fecha_baja/
      // estado/pin_hash/nombre_usuario/pin_bloqueado/intentos_fallidos/
      // user_id quedan DEPRECADOS — pertenecen al modelo contractual
      // (rrhh.contratos/rrhh.contrato_credenciales, F1.2/F1.3) o a
      // core.identidad (diseno objetivo), no al Expediente General. Se
      // dejan nullable/con default y comentadas via `comment on column`
      // en 20260907152301_f1_1_separar_expediente_general_laboral.sql —
      // no se eliminan todavia (columnas reales en produccion, pendiente
      // de una migracion de limpieza posterior). rrhh.fn_crear_empleado
      // ya no las escribe.
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
          /** @deprecated F1.1 — pertenece a rrhh.contratos (F1.2). */
          puesto: string | null;
          /** @deprecated F1.1 — pertenece a rrhh.contratos (F1.2). */
          departamento: string | null;
          /** @deprecated F1.1 — pertenece a rrhh.contratos.fecha_inicio (F1.2). Nullable desde F1.1. */
          fecha_ingreso: string | null;
          /** @deprecated F1.1 — pertenece a rrhh.contratos.fecha_fin_real (F1.2). */
          fecha_baja: string | null;
          /** @deprecated F1.1 — pertenece a rrhh.contratos.estado (F1.2). Default 'sin_contrato' desde F1.1. */
          estado: "sin_contrato" | "activo" | "inactivo" | "baja";
          /** @deprecated F1.1 — pasa a rrhh.contrato_credenciales (F1.3). Hash bcrypt, nunca el PIN en texto plano. */
          pin_hash: string | null;
          /** @deprecated F1.1 — diseño de "PIN de doble propósito" rechazado (docs/DRIVER_ACCESS_AND_KIOSK.md §10). Nullable desde F1.1. */
          nombre_usuario: string | null;
          /** @deprecated F1.1 — pasa a rrhh.contrato_credenciales (F1.3). */
          pin_bloqueado: boolean;
          /** @deprecated F1.1 — pasa a rrhh.contrato_credenciales (F1.3). */
          intentos_fallidos: number;
          /** @deprecated F1.1 — pertenece a core.identidad (diseño objetivo, sin implementar). */
          user_id: string | null;
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
          /** @deprecated F1.1 */
          puesto?: string | null;
          /** @deprecated F1.1 */
          departamento?: string | null;
          /** @deprecated F1.1 — nullable desde F1.1, rrhh.fn_crear_empleado ya no lo fija */
          fecha_ingreso?: string | null;
          /** @deprecated F1.1 */
          fecha_baja?: string | null;
          /** @deprecated F1.1 — default 'sin_contrato' */
          estado?: "sin_contrato" | "activo" | "inactivo" | "baja";
          pin_hash?: never; // nunca via Insert directo, usar RPC
          /** @deprecated F1.1 — nullable desde F1.1 */
          nombre_usuario?: string | null;
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
          fecha_ingreso?: string | null;
          fecha_baja?: string | null;
          estado?: "sin_contrato" | "activo" | "inactivo" | "baja";
          pin_hash?: never;
          nombre_usuario?: string | null;
          pin_bloqueado?: boolean; // via Update directo: camino de desbloqueo, protegido por la policy de empleados.editar
          intentos_fallidos?: number;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Expediente Laboral (F1.2, 2026-09-07) — ver
      // supabase/migrations/20260907153604_f1_2_rrhh_contratos.sql.
      // Un solo contrato 'activo' por empleado (unique index parcial);
      // estado borrador->activo->finalizado sin reabrir (trigger
      // rrhh.fn_validar_transicion_contrato). Se escribe solo via RPC
      // (crear_contrato/editar_contrato/activar_contrato/finalizar_contrato).
      contratos: {
        Row: {
          id: string;
          company_id: string;
          empleado_id: string;
          numero_contrato: number;
          estado: "borrador" | "activo" | "finalizado";
          puesto: string | null;
          departamento: string | null;
          modalidad_contrato: "nomina_estandar" | "comisionista_destajo" | null;
          fecha_inicio: string | null;
          fecha_fin_prevista: string | null;
          fecha_fin_real: string | null;
          created_at: string;
          created_by: string | null;
          activado_at: string | null;
          activado_by: string | null;
          finalizado_at: string | null;
          finalizado_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          empleado_id: string;
          numero_contrato?: never; // generated always as identity
          estado?: "borrador" | "activo" | "finalizado";
          puesto?: string | null;
          departamento?: string | null;
          modalidad_contrato?: "nomina_estandar" | "comisionista_destajo" | null;
          fecha_inicio?: string | null;
          fecha_fin_prevista?: string | null;
          fecha_fin_real?: string | null;
          created_at?: string;
          created_by?: string | null;
          activado_at?: string | null;
          activado_by?: string | null;
          finalizado_at?: string | null;
          finalizado_by?: string | null;
          updated_at?: string;
        };
        Update: {
          // Solo estado='borrador' es editable por RLS/UPDATE directo;
          // activar/finalizar son transiciones exclusivas de sus RPC.
          puesto?: string | null;
          departamento?: string | null;
          modalidad_contrato?: "nomina_estandar" | "comisionista_destajo" | null;
          fecha_inicio?: string | null;
          fecha_fin_prevista?: string | null;
        };
        Relationships: [];
      };
      // Credencial de asistencia del contrato (F1.3, 2026-09-07) — ver
      // supabase/migrations/20260907154715_f1_3_pin_exclusivamente_contractual.sql.
      // Sin GRANT de SELECT a nadie (ni siquiera authenticated) -- RLS
      // habilitado SIN policies, deny-by-default total. pin_hash NUNCA
      // se lee desde la app: toda interaccion pasa por RPC (activar_contrato/
      // regenerar_pin_contrato/estado_credencial_contrato), que ni
      // siquiera seleccionan esa columna en su respuesta. No se usa
      // .from("contrato_credenciales") en ningun lado del codigo — este
      // tipo existe solo por completitud de documentacion del schema.
      contrato_credenciales: {
        Row: {
          id: string;
          company_id: string;
          contrato_id: string;
          pin_hash: string;
          activo: boolean;
          pin_bloqueado: boolean;
          intentos_fallidos: number;
          rotacion_numero: number;
          creado_at: string;
          creado_by: string | null;
          revocado_at: string | null;
          revocado_by: string | null;
        };
        Insert: never; // solo via rrhh.fn_activar_contrato
        Update: never; // solo via rrhh.fn_regenerar_pin_contrato/fn_finalizar_contrato
        Relationships: [];
      };
      // 1:1 con el contrato, no con el empleado (D-03) — asi una
      // recontratacion/cambio de salario crea un contrato nuevo en vez
      // de sobreescribir el historico. Reutiliza rrhh.expedientes.
      // compensacion.ver/editar (permisos existentes de F1.0-era,
      // re-scopeados al contrato). Sin policy de insert/update/delete
      // directo -- solo vía RPC.
      contrato_compensacion: {
        Row: {
          contrato_id: string;
          company_id: string;
          salario_base: number;
          frecuencia_pago: "mensual" | "quincenal" | "semanal";
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never; // solo via rrhh.fn_crear_contrato/fn_editar_contrato
        Update: never;
        Relationships: [];
      };
      // F1.4 (2026-09-07) — plantilla de jornada reutilizable, ver
      // supabase/migrations/20260907163244_f1_4_rrhh_jornadas_minimas.sql.
      jornadas: {
        Row: {
          id: string;
          company_id: string;
          nombre: string;
          descripcion: string | null;
          activo: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          nombre: string;
          descripcion?: string | null;
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          nombre?: string;
          descripcion?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      // Un unico bloque entrada/salida por dia (1=lunes..7=domingo,
      // ISO-8601) -- sin turnos nocturnos ni cruce de medianoche.
      jornada_dias: {
        Row: {
          id: string;
          jornada_id: string;
          company_id: string;
          dia_semana: number;
          laborable: boolean;
          hora_entrada: string | null;
          hora_salida: string | null;
          minutos_descanso: number;
          tolerancia_entrada_min: number;
          tolerancia_salida_min: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          jornada_id: string;
          company_id: string;
          dia_semana: number;
          laborable?: boolean;
          hora_entrada?: string | null;
          hora_salida?: string | null;
          minutos_descanso?: number;
          tolerancia_entrada_min?: number;
          tolerancia_salida_min?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          laborable?: boolean;
          hora_entrada?: string | null;
          hora_salida?: string | null;
          minutos_descanso?: number;
          tolerancia_entrada_min?: number;
          tolerancia_salida_min?: number;
        };
        Relationships: [];
      };
      // Historico de asignacion de jornada a un contrato, por rango de
      // vigencia -- escritura SOLO via rrhh.fn_asignar_jornada_contrato
      // (sin policy de insert/update/delete para authenticated).
      contrato_jornadas: {
        Row: {
          id: string;
          company_id: string;
          contrato_id: string;
          jornada_id: string;
          vigente_desde: string;
          vigente_hasta: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: never; // solo via rrhh.fn_asignar_jornada_contrato
        Update: never;
        Relationships: [];
      };
      // Calendario de feriados por empresa. Sin tipo/alcance ni pago --
      // sin regla de negocio definida todavia (ver docs/RRHH_MVP.md).
      feriados: {
        Row: {
          id: string;
          company_id: string;
          fecha: string;
          nombre: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id?: string;
          fecha: string;
          nombre: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          fecha?: string;
          nombre?: string;
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
/** @deprecated F1.1 — estado laboral pasa a rrhh.contratos.estado (F1.2); 'sin_contrato' es el nuevo default del Expediente General. */
export type EstadoEmpleado = "sin_contrato" | "activo" | "inactivo" | "baja";
export type EstadoPlanilla = "borrador" | "aprobada" | "anulada";
export type ModalidadContrato = "nomina_estandar" | "comisionista_destajo";
