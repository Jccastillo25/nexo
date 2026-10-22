import { misPermisos } from "@nexo/auth";

/**
 * Códigos de Atención que usa la interfaz (Paso Cero 20261014222454 y
 * 20261015165620). Las Server Actions no dependen de esta lista: cada una
 * llama a requirePermission con su código antes de mutar.
 */
export const P = {
  modulo: "atencion.ver_modulo",
  colaVer: "atencion.cola.turno.ver",
  turnoCrear: "atencion.recepcion.turno.crear",
  turnoAnular: "atencion.recepcion.turno.cancelar",
  turnoReactivar: "atencion.cola.turno.reactivar",
  turnoLlamar: "atencion.puesto.turno.llamar",
  turnoFueraOrden: "atencion.puesto.turno.llamar_fuera_orden",
  turnoFinalizar: "atencion.puesto.turno.finalizar",
  turnoAusente: "atencion.puesto.turno.marcar_ausente",
  puestosGestionar: "atencion.configuracion.puesto.gestionar",
  pantallasGestionar: "atencion.configuracion.pantalla.gestionar",
  misMetricas: "atencion.reportes.mis_metricas.ver",
  reportes: "atencion.reportes.turno.ver",
} as const;

export type Permiso = keyof typeof P;
export type Permisos = Record<Permiso, boolean>;

const CLAVES = Object.keys(P) as Permiso[];
const CODIGOS = Object.values(P);

/**
 * Permisos del usuario actual en Atención, para ocultar o deshabilitar en la
 * UI. Layout y páginas piden SIEMPRE esta misma lista: misPermisos (cacheada
 * por request) hace una sola consulta por carga. No reemplaza a
 * requirePermission.
 */
export async function permisosDe(): Promise<Permisos> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P[k])])) as Permisos;
}
