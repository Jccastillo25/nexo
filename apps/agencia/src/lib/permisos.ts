import { misPermisos } from "@nexo/auth";

/** Códigos del Paso Cero de Agencia. */
export const P = {
  modulo: "agencia.ver_modulo",
  dashboard: "agencia.dashboard.resumen.ver",
} as const;

export type Permiso = keyof typeof P;
export type Permisos = Record<Permiso, boolean>;

const CLAVES = Object.keys(P) as Permiso[];
const CODIGOS = Object.values(P);

/**
 * Permisos del módulo del usuario actual, para ocultar o denegar en la UI.
 * Layout y páginas piden SIEMPRE esta misma lista, así misPermisos (cacheada
 * por request) hace una sola consulta por carga.
 */
export async function permisosDe(): Promise<Permisos> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P[k])])) as Permisos;
}
