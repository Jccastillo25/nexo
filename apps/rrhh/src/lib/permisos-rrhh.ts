import { misPermisos } from "@nexo/auth";

/**
 * Todos los códigos de permiso que usa la UI de RRHH (layout, dashboard y
 * pantallas de expedientes, contratación, jornadas, feriados, catálogos y
 * Planilla). Una sola lista constante: misPermisos la cachea por request con
 * esa clave, así layout y página comparten UNA consulta. Pedir otra lista
 * distinta sería otra consulta. Asistencia tiene su propia lista
 * (lib/permisos-asistencia.ts).
 *
 * Planilla (2026-10-21): los 27 códigos `rrhh.planillas.*` del Paso Cero
 * (20260902000005, 20260902000008, 20261021160943 y 20261022000001) más
 * `rrhh.asistencia.reportes.ver`, que exige planilla_asistencia_propuesta
 * para leer marcas. Planilla vive dentro del menú de RRHH: no tiene permiso
 * de módulo propio (lo protege `rrhh.ver_modulo` en el layout).
 */
export const P = {
  modulo: "rrhh.ver_modulo",
  empleadosVer: "rrhh.expedientes.empleados.ver",
  empleadosCrear: "rrhh.expedientes.empleados.crear",
  empleadosEditar: "rrhh.expedientes.empleados.editar",
  empleadosEliminar: "rrhh.expedientes.empleados.eliminar",
  direccionVer: "rrhh.expedientes.direccion.ver",
  direccionEditar: "rrhh.expedientes.direccion.editar",
  infoComplementariaVer: "rrhh.expedientes.info_complementaria.ver",
  infoComplementariaEditar: "rrhh.expedientes.info_complementaria.editar",
  cuentasBancariasVer: "rrhh.expedientes.cuentas_bancarias.ver",
  cuentasBancariasEditar: "rrhh.expedientes.cuentas_bancarias.editar",
  beneficiariosVer: "rrhh.expedientes.beneficiarios.ver",
  beneficiariosEditar: "rrhh.expedientes.beneficiarios.editar",
  documentosVer: "rrhh.expedientes.documentos.ver",
  documentosSubir: "rrhh.expedientes.documentos.subir",
  documentosDescargar: "rrhh.expedientes.documentos.descargar",
  documentosEliminar: "rrhh.expedientes.documentos.eliminar",
  contratosVer: "rrhh.expedientes.contratos.ver",
  contratosCrear: "rrhh.expedientes.contratos.crear",
  contratosEditar: "rrhh.expedientes.contratos.editar",
  contratosActivar: "rrhh.expedientes.contratos.activar",
  contratosFinalizar: "rrhh.expedientes.contratos.finalizar",
  compensacionVer: "rrhh.expedientes.compensacion.ver",
  compensacionEditar: "rrhh.expedientes.compensacion.editar",
  credencialesVer: "rrhh.expedientes.credenciales.ver",
  credencialesRegenerar: "rrhh.expedientes.credenciales.regenerar",
  puestosVer: "rrhh.expedientes.puestos.ver",
  puestosCrear: "rrhh.expedientes.puestos.crear",
  puestosEditar: "rrhh.expedientes.puestos.editar",
  departamentosVer: "rrhh.expedientes.departamentos.ver",
  departamentosCrear: "rrhh.expedientes.departamentos.crear",
  departamentosEditar: "rrhh.expedientes.departamentos.editar",
  plantillasVer: "rrhh.expedientes.plantillas.ver",
  plantillasCrear: "rrhh.expedientes.plantillas.crear",
  plantillasEditar: "rrhh.expedientes.plantillas.editar",
  turnosVer: "rrhh.asistencia.turnos.ver",
  turnosCrear: "rrhh.asistencia.turnos.crear",
  turnosEditar: "rrhh.asistencia.turnos.editar",
  turnosEliminar: "rrhh.asistencia.turnos.eliminar",
  feriadosVer: "rrhh.asistencia.feriados.ver",
  feriadosCrear: "rrhh.asistencia.feriados.crear",
  feriadosEliminar: "rrhh.asistencia.feriados.eliminar",
  // Planilla y prestaciones.
  planillaVer: "rrhh.planillas.planilla.ver",
  planillaGenerar: "rrhh.planillas.planilla.generar",
  planillaAprobar: "rrhh.planillas.planilla.aprobar",
  planillaAnular: "rrhh.planillas.planilla.anular",
  planillaPagar: "rrhh.planillas.planilla.pagar",
  novedadesVer: "rrhh.planillas.movimientos.ver",
  novedadesCrear: "rrhh.planillas.movimientos.crear",
  novedadesAnular: "rrhh.planillas.movimientos.eliminar",
  planillaExportar: "rrhh.planillas.reportes.exportar",
  parametrosVer: "rrhh.planillas.parametros.ver",
  parametrosEditar: "rrhh.planillas.parametros.editar",
  regimenVer: "rrhh.planillas.regimen.ver",
  regimenCambiar: "rrhh.planillas.regimen.cambiar",
  conceptosVer: "rrhh.planillas.conceptos.ver",
  conceptosGestionar: "rrhh.planillas.conceptos.gestionar",
  vacacionesVer: "rrhh.planillas.vacaciones.ver",
  vacacionesRegistrar: "rrhh.planillas.vacaciones.registrar",
  vacacionesAprobar: "rrhh.planillas.vacaciones.aprobar",
  prestamosVer: "rrhh.planillas.prestamos.ver",
  prestamosGestionar: "rrhh.planillas.prestamos.gestionar",
  liquidacionesVer: "rrhh.planillas.liquidaciones.ver",
  liquidacionesCalcular: "rrhh.planillas.liquidaciones.calcular",
  liquidacionesAprobar: "rrhh.planillas.liquidaciones.aprobar",
  liquidacionesPagar: "rrhh.planillas.liquidaciones.pagar",
  liquidacionesAnular: "rrhh.planillas.liquidaciones.anular",
  declaracionesGenerar: "rrhh.planillas.declaraciones.generar",
  colillasEnviar: "rrhh.planillas.colillas.enviar",
  asistenciaReportesVer: "rrhh.asistencia.reportes.ver",
} as const;

export type PermisoRrhh = keyof typeof P;
export type PermisosRrhh = Record<PermisoRrhh, boolean>;
/** Un código de la lista `P` (para requirePermission/prepararAccion con tipos). */
export type CodigoRrhh = (typeof P)[PermisoRrhh];

const CLAVES = Object.keys(P) as PermisoRrhh[];
const CODIGOS = Object.values(P);

/**
 * Permisos de RRHH del usuario actual, para ocultar o deshabilitar en la UI.
 * Layout y páginas piden siempre esta misma lista: una sola consulta por
 * carga. Las Server Actions NO la usan: llaman a requirePermission antes de
 * mutar.
 */
export async function permisosDe(): Promise<PermisosRrhh> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P[k])])) as PermisosRrhh;
}
