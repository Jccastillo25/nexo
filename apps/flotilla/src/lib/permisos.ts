import { misPermisos } from "@nexo/auth";

/** Códigos del Paso Cero de Entregas (20261024034727, plan 22 §19). */
export const P = {
  modulo: "flotilla.ver_modulo",
  dashboard: "flotilla.dashboard.indicadores.ver",
  ordenPropiaVer: "flotilla.entregas.orden_propia.ver",
  ordenVer: "flotilla.entregas.orden.ver",
  ordenCrear: "flotilla.entregas.orden.crear",
  ordenEditar: "flotilla.entregas.orden.editar",
  ordenCancelar: "flotilla.entregas.orden.cancelar",
  ordenCerrar: "flotilla.entregas.orden.cerrar",
  ordenReabrir: "flotilla.entregas.orden.reabrir",
  pagoValidar: "flotilla.entregas.pago.validar",
  materialValidar: "flotilla.entregas.material.validar",
  clienteConfirmar: "flotilla.entregas.cliente.confirmar",
  cobroConciliar: "flotilla.entregas.cobro.conciliar",
  recepcionCorregir: "flotilla.entregas.recepcion.corregir",
  evidenciaVer: "flotilla.entregas.evidencia.ver",
  evidenciaAdjuntar: "flotilla.entregas.evidencia.adjuntar",
  recorridoVer: "flotilla.rutas.recorrido.ver",
  recorridoProgramar: "flotilla.rutas.recorrido.programar",
  recorridoDespachar: "flotilla.rutas.recorrido.despachar",
  paradaReprogramar: "flotilla.rutas.parada.reprogramar",
  recorridoCerrar: "flotilla.rutas.recorrido.cerrar",
  cargaPreparar: "flotilla.bodega.carga.preparar",
  cargaValidar: "flotilla.bodega.carga.validar",
  retornoConciliar: "flotilla.bodega.retorno.conciliar",
  conductorOperar: "flotilla.conductor.recorrido_propio.operar",
  incidenciaCrear: "flotilla.incidencias.incidencia.crear",
  incidenciaGestionar: "flotilla.incidencias.incidencia.gestionar",
  incidenciaResolver: "flotilla.incidencias.incidencia.resolver",
  vehiculoVer: "flotilla.flota.vehiculo.ver",
  vehiculoGestionar: "flotilla.flota.vehiculo.gestionar",
  conductoresVer: "flotilla.conductores.perfil.ver",
  conductoresHabilitar: "flotilla.conductores.perfil.habilitar",
  reglas: "flotilla.configuracion.reglas.gestionar",
  excepcion: "flotilla.configuracion.excepcion.aprobar",
  reportesVer: "flotilla.reportes.entregas.ver",
  reportesExportar: "flotilla.reportes.entregas.exportar",
} as const;

export type Permiso = keyof typeof P;
export type Permisos = Record<Permiso, boolean>;

const CLAVES = Object.keys(P) as Permiso[];
const CODIGOS = Object.values(P);

/**
 * Todos los permisos del módulo del usuario actual, para ocultar o
 * deshabilitar en la UI. Layout y páginas piden SIEMPRE esta misma lista, así
 * misPermisos (cacheada por request) hace una sola consulta por carga.
 * Las mutaciones no confían en esto: el backend valida cada acción.
 */
export async function permisosDe(): Promise<Permisos> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P[k])])) as Permisos;
}

/** Ve alguna orden, sea solo las propias o las de toda la empresa. */
export function veOrdenes(p: Permisos): boolean {
  return p.ordenVer || p.ordenPropiaVer;
}
