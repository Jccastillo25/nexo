import "server-only";
import { misPermisos } from "@nexo/auth";

/**
 * Códigos de permiso que usa la UI del panel (core.permissions_catalog):
 * administración de usuarios, roles, sucursales y auditoría
 * (20261014203144_nexo_usuarios_roles_esquema) y la marca de la plataforma
 * (nexo.configuracion.editar, 20260830000011_platform_settings).
 */
export const P = {
  usuariosVer: "nexo.administracion.usuarios.ver",
  usuariosCrear: "nexo.administracion.usuarios.crear",
  usuariosEditar: "nexo.administracion.usuarios.editar",
  usuariosDesactivar: "nexo.administracion.usuarios.desactivar",
  rolesVer: "nexo.administracion.roles.ver",
  rolesCrear: "nexo.administracion.roles.crear",
  rolesEditar: "nexo.administracion.roles.editar",
  rolesEliminar: "nexo.administracion.roles.eliminar",
  sucursalesVer: "nexo.administracion.sucursales.ver",
  sucursalesGestionar: "nexo.administracion.sucursales.gestionar",
  auditoriaVer: "nexo.administracion.auditoria.ver",
  marcaEditar: "nexo.configuracion.editar",
} as const;

export type Permiso = keyof typeof P;
export type Permisos = Record<Permiso, boolean>;

const CLAVES = Object.keys(P) as Permiso[];
const CODIGOS = Object.values(P);

/**
 * Permisos del usuario de la sesión, para ocultar o deshabilitar en la UI.
 * Layout, Launcher y páginas piden SIEMPRE esta misma lista: misPermisos
 * (cacheada por request) hace una sola consulta por carga.
 * Las Server Actions no la usan: llaman a requirePermission antes de mutar.
 */
export async function permisosDe(): Promise<Permisos> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P[k])])) as Permisos;
}
