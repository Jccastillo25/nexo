/**
 * `basePath` de esta app (apps/rrhh/next.config.ts). `next/link` y
 * `router.push` lo agregan solos, pero `fetch()` no: la descarga del PDF
 * (fetch al Route Handler para poder mostrar el error con un toast) arma la
 * URL con esta constante. Si cambia el basePath, cambia aquí también.
 */
export const RRHH_BASE_PATH = "/rrhh";

/** Ruta interna (sin basePath, para next/link) de la pantalla de un reporte. */
export function rutaReporte(reporte: string, query?: string): string {
  return `/asistencia/reportes/${reporte}${query ? `?${query}` : ""}`;
}

/** Ruta interna (sin basePath, para next/link) de la vista de impresión. */
export function rutaImpresion(reporte: string, query: string): string {
  return `/asistencia/imprimir/${reporte}?${query}`;
}

/** URL absoluta de ruta (con basePath, para fetch) del PDF. */
export function urlPdf(reporte: string, query: string): string {
  return `${RRHH_BASE_PATH}/asistencia/reportes/exportar/${reporte}?${query}`;
}
