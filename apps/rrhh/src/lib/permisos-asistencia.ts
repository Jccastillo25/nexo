import { cache } from "react";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Permisos de la app Asistencia (separada de RRHH el 2026-10-17; vive en el
 * mismo deploy, bajo /rrhh/asistencia). La visibilidad de la app es
 * `asistencia.ver_modulo` (creado por trg_seed_module_permission al
 * registrar el slug en core.apps); los permisos de contenido son los que ya
 * existían en el catálogo bajo `rrhh.asistencia.*`.
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
} as const;

export type PermisoAsistencia = keyof typeof P_ASISTENCIA;
export type PermisosAsistencia = Record<PermisoAsistencia, boolean>;

/**
 * Todos los permisos de Asistencia del usuario actual (para ocultar/deshabilitar
 * en la UI). Con `cache()` se calculan una vez por solicitud aunque los pidan
 * el layout y la página. Las Server Actions validan con `requirePermission`.
 */
export const permisosAsistenciaDe = cache(async (companyId: string): Promise<PermisosAsistencia> => {
  const supabase = await createClient();
  const claves = Object.keys(P_ASISTENCIA) as PermisoAsistencia[];
  const valores = await Promise.all(claves.map((k) => hasPermission({ supabase, companyId }, P_ASISTENCIA[k])));
  return Object.fromEntries(claves.map((k, i) => [k, valores[i]])) as PermisosAsistencia;
});
