/**
 * Foco después de cerrar un diálogo del Paquete C (Prestaciones), cuando el
 * botón que lo abrió ya no existe: el menú "⋯" (RowActionsMenu) se cierra al
 * elegir una acción, y tras aprobar, rechazar, anular o cancelar la fila cambia
 * de botones o desaparece de la lista. Sin esto el foco cae en <body>.
 *
 * Espera dos cuadros: para entonces React ya desmontó el diálogo (que al
 * desmontarse intenta devolver el foco por su cuenta). No hace nada si el
 * destino no existe. Solo en el navegador (manejadores de eventos).
 */
export function enfocarDespues(destino: () => HTMLElement | null | undefined): void {
  requestAnimationFrame(() => requestAnimationFrame(() => destino()?.focus()));
}

/** Clases del destino de foco (encabezado con tabIndex={-1}): anillo solo con teclado. */
export const CLASE_DESTINO_FOCO = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
