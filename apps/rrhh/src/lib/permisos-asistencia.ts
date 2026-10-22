import { misPermisos } from "@nexo/auth";

/**
 * Permisos de la app Asistencia (separada de RRHH el 2026-10-17; vive en el
 * mismo deploy, bajo /rrhh/asistencia). La visibilidad de la app es
 * `asistencia.ver_modulo` (creado por trg_seed_module_permission al
 * registrar el slug en core.apps); los permisos de contenido son los que ya
 * existían en el catálogo bajo `rrhh.asistencia.*`.
 *
 * Solo servidor (`@nexo/auth` es server-only). Desde un Client Component,
 * únicamente `import type`.
 */
export const P_ASISTENCIA = {
  modulo: "asistencia.ver_modulo",
  marcasVer: "rrhh.asistencia.marcas.ver",
  justificacionesVer: "rrhh.asistencia.justificaciones.ver",
  kioskosVer: "rrhh.asistencia.kioskos.ver",
  kioskosCrear: "rrhh.asistencia.kioskos.crear",
  kioskosEditar: "rrhh.asistencia.kioskos.editar",
  kioskosAsignar: "rrhh.asistencia.kioskos.asignar",
  kioskosRevocar: "rrhh.asistencia.kioskos.revocar",
  // Reportes (2026-10-18): consultar en pantalla / exportar PDF e imprimir.
  reportesVer: "rrhh.asistencia.reportes.ver",
  reportesExportar: "rrhh.asistencia.reportes.exportar",
} as const;

export type PermisoAsistencia = keyof typeof P_ASISTENCIA;
export type PermisosAsistencia = Record<PermisoAsistencia, boolean>;

const CLAVES = Object.keys(P_ASISTENCIA) as PermisoAsistencia[];

/**
 * Lista constante (mezcla `asistencia.*` y `rrhh.asistencia.*`). El layout de
 * Asistencia, el de impresión y cada página piden SIEMPRE esta misma lista:
 * misPermisos la cachea por request con esa clave, así que hay UNA sola
 * consulta (public.mis_permisos) por carga.
 */
const CODIGOS: readonly string[] = Object.values(P_ASISTENCIA);

/**
 * Permisos de Asistencia del usuario de la sesión, para ocultar o deshabilitar
 * en la UI. No reemplaza a requirePermission: las Server Actions y el Route
 * Handler del PDF validan su permiso en el servidor antes de actuar.
 */
export async function permisosAsistencia(): Promise<PermisosAsistencia> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P_ASISTENCIA[k])])) as PermisosAsistencia;
}
