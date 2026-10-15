// Tipos de nexo-core (schema public) que usa este módulo. Escritos a mano,
// igual que en las demás apps (ver docs/DATABASE.md). RPC de la migración
// 20261014224341_atencion_esquema.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface SesionAtencion {
  tipo: "recepcion" | "puesto";
  inicio: string;
  sucursal_id: string;
  sucursal: string;
  puesto_id: string | null;
  puesto: string | null;
}

export interface MiEstado {
  sesion: SesionAtencion | null;
  puede_recepcion: boolean;
  puede_puesto: boolean;
  sucursales: { id: string; nombre: string }[];
}

export interface TurnoCola {
  id: string;
  numero: number;
  estado: "esperando" | "llamado" | "atendido" | "ausente" | "anulado" | "expirado";
  puesto: string | null;
  llamado_en: string | null;
  veces_llamado: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  factura: string | null;
  creado_en: string;
  /** Llamado que sacó el turno de la espera; no cambia con "Repetir llamado" (20261015163957). */
  inicio_atencion_en: string | null;
  finalizado_en: string | null;
  /** Desde cuándo está en la fila: alta o última reactivación (20261015172012). Mide la espera. */
  en_fila_desde: string;
  reactivaciones: number;
  /** "No se presentó" de otro día cuya factura se volvió a registrar. */
  reemplazado: boolean;
}

export interface PuestoEstado {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  ocupado_por: string | null;
  ocupado_desde: string | null;
}

/** Datos opcionales del turno llamado; el número siempre sale. */
export type CampoPantalla = "cliente" | "agente" | "puesto" | "factura";
export type CamposPantalla = Partial<Record<CampoPantalla, boolean>>;

export interface PantallaConfig {
  youtube?: string;
  volumen?: number;
  /** Qué se ve en el televisor. Sin clave = sí (factura: no). */
  mostrar?: CamposPantalla;
  /** Qué se dice por voz. Sin clave = sí (factura: no). */
  anunciar?: CamposPantalla;
}

/**
 * Valor efectivo de un campo. Ausente = activado, salvo la factura, que es
 * opt-in (mismo criterio que la RPC de la pantalla, 20261015180000).
 */
export function campoActivo(campos: CamposPantalla | undefined, campo: CampoPantalla): boolean {
  return campos?.[campo] ?? campo !== "factura";
}

export interface Pantalla {
  id: string;
  nombre: string;
  activa: boolean;
  config: PantallaConfig;
}

export interface PantallaEstado {
  sucursal: string;
  config: PantallaConfig;
  // cliente/agente/puesto/factura llegan null si la pantalla no los muestra ni los anuncia.
  llamados: {
    numero: number;
    puesto?: string | null;
    cliente?: string | null;
    agente?: string | null;
    factura?: string | null;
    llamado_en: string;
    veces: number;
  }[];
  proximos: number[];
  generado_en: string;
}

type C = { p_company_id: string };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      has_permission: { Args: { p_code: string; p_company_id: string }; Returns: boolean };
      get_platform_settings: {
        Args: Record<PropertyKey, never>;
        Returns: { copyright_text: string | null; logo_url: string | null; favicon_url: string | null }[];
      };
      atencion_mi_estado: { Args: C; Returns: Json };
      atencion_iniciar: { Args: C & { p_sucursal_id?: string | null; p_tipo?: string | null }; Returns: Json };
      atencion_cerrar: { Args: C; Returns: undefined };
      atencion_liberar: { Args: C & { p_user_id: string }; Returns: undefined };
      atencion_crear_turno: {
        Args: C & { p_cliente_nombre: string; p_cliente_telefono?: string | null; p_factura?: string | null };
        Returns: Json;
      };
      atencion_cancelar_turno: { Args: C & { p_turno_id: string }; Returns: undefined };
      // atencion_cola y atencion_cola_v2 quedan sin uso desde 20261015172012; retirarlas.
      atencion_cola_v3: { Args: C & { p_sucursal_id?: string | null }; Returns: TurnoCola[] };
      atencion_reactivar_turno: { Args: C & { p_turno_id: string }; Returns: Json };
      atencion_metricas: {
        Args: C & { p_desde: string; p_hasta: string; p_sucursal_id?: string | null; p_solo_mias?: boolean };
        Returns: Json;
      };
      atencion_sucursales_reportes: { Args: C; Returns: { id: string; nombre: string }[] };
      atencion_llamar: { Args: C & { p_turno_id?: string | null }; Returns: Json };
      atencion_rellamar: { Args: C; Returns: Json };
      atencion_terminar: { Args: C & { p_resultado: string }; Returns: undefined };
      atencion_listar_puestos: { Args: C & { p_sucursal_id: string }; Returns: PuestoEstado[] };
      atencion_guardar_puesto: {
        Args: C & {
          p_puesto_id: string | null;
          p_sucursal_id: string;
          p_nombre: string;
          p_orden: number;
          p_activo: boolean;
        };
        Returns: string;
      };
      atencion_listar_pantallas: { Args: C & { p_sucursal_id: string }; Returns: Pantalla[] };
      atencion_guardar_pantalla: {
        Args: C & {
          p_pantalla_id: string | null;
          p_sucursal_id: string;
          p_nombre: string;
          p_activa: boolean;
          p_config: Json;
        };
        Returns: string;
      };
      atencion_pantalla_estado: { Args: { p_pantalla_id: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
