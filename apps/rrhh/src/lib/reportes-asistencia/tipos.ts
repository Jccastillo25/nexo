/**
 * Formas de lo que devuelven las RPC de reportes de Asistencia
 * (supabase/migrations/20261018014127_asistencia_reportes.sql). Las RPC
 * devuelven `jsonb`; database.types.ts las declara como `Json` y aquí se
 * fija la forma real para el código de la app.
 *
 * Solo tipos: este archivo no tiene código ejecutable, así que se puede
 * importar con `import type` desde los módulos puros sin romper las pruebas
 * de `node --experimental-strip-types`.
 */

/** Lista de valores en `REPORTES` (formato.ts). */
export type Reporte = "diaria" | "resumen" | "tardanzas" | "incidencias" | "tarjeta";

/** Una fila por contrato y día (R1, R3, R4 y R5 comparten esta forma). */
export type FilaDiaria = {
  fecha: string;
  es_hoy: boolean;
  contrato_id: string;
  contrato_numero: number;
  empleado_id: string;
  empleado_codigo: number;
  empleado_nombre: string;
  departamento_id: string | null;
  departamento: string | null;
  puesto_id: string | null;
  puesto: string | null;
  jornada_id: string | null;
  jornada_nombre: string | null;
  laborable: boolean;
  es_feriado: boolean;
  feriado_nombre: string | null;
  hora_entrada_prog: string | null;
  hora_salida_prog: string | null;
  descanso_prog_min: number | null;
  tol_entrada_min: number | null;
  tol_salida_min: number | null;
  entrada: string | null;
  inicio_descanso: string | null;
  fin_descanso: string | null;
  salida: string | null;
  marcas_count: number;
  secuencia: string[];
  descanso_real_min: number | null;
  descanso_aplicado_min: number | null;
  descanso_origen: "marcado" | "programado" | "ninguno" | string;
  minutos_netos: number | null;
  minutos_programados: number | null;
  minutos_sobre_jornada: number | null;
  minutos_no_laborable: number | null;
  minutos_tardanza: number | null;
  minutos_salida_temprana: number | null;
  estado: string;
  observaciones: string[] | null;
  /** Solo en incidencias. */
  tipo?: string;
};

export type FilaResumen = {
  contrato_id: string;
  contrato_numero: number;
  empleado_id: string;
  empleado_codigo: number;
  empleado_nombre: string;
  departamento: string | null;
  dias_laborables: number;
  dias_asistidos: number;
  ausencias: number;
  incompletos: number;
  minutos_programados: number;
  minutos_netos: number;
  minutos_sobre_jornada: number;
  minutos_no_laborable: number;
  tardanzas: number;
  minutos_tardanza: number;
  salidas_tempranas: number;
  minutos_salida_temprana: number;
  dias_evaluables: number;
  dias_puntuales: number;
  puntualidad: number | null;
  promedio_tardanza: number | null;
};

/** Totales: cada reporte trae claves distintas; todas numéricas (o null). */
export type Totales = Record<string, number | null>;

export type DatosReporte =
  | { reporte: "resumen"; total: number; totales: Totales; filas: FilaResumen[] }
  | { reporte: Exclude<Reporte, "resumen">; total: number; totales: Totales; filas: FilaDiaria[] };

export type OpcionId = { id: string; nombre: string };
export type ContratoOpcion = { id: string; numero: number; estado: string };
export type EmpleadoOpcion = { id: string; label: string; contratos: ContratoOpcion[] | null };
export type OpcionesReporte = {
  departamentos: OpcionId[];
  puestos: OpcionId[];
  empleados: EmpleadoOpcion[];
};

/** Respuesta de asistencia_registrar_exportacion. */
export type Emision = {
  emitido_en: string;
  emitido_por: string | null;
  empresa: string | null;
  empresa_ruc: string | null;
};

export type FiltrosReporte = {
  desde: string;
  hasta: string;
  departamentoId: string;
  puestoId: string;
  empleadoId: string;
  contratoId: string;
  estado: string;
  tipo: string;
  incluirNoLaborables: boolean;
  pagina: number;
};
