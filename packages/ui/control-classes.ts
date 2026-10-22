// Clases de los controles de formulario de la suite (Nexo Enterprise UI v2,
// 2026-10-20). Viven en un archivo SIN "use client" a proposito: Field.tsx es
// componente cliente, y un valor exportado desde un modulo "use client" llega
// al servidor como referencia de cliente, no como texto (error real del
// 2026-10-17 en Productos). Asi un Server Component puede usarlas tal cual.
//
// Reemplaza las ~20 copias de `inputClass` repartidas por las apps. Lo normal
// es usar <Input>/<Select>/<Textarea>; esto es para un control propio que
// tenga que verse igual.

/**
 * Base comun: alto de 36px, borde neutral-300, hover neutral-400, foco con
 * borde blue-600 y halo de 3px al 15 %, invalido en rojo (aria-invalid) y
 * deshabilitado en neutral-50. En movil el texto sube a 16px para que iOS no
 * haga zoom al enfocar.
 */
export const controlClassName =
  "block w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 shadow-xs transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-600 focus:outline-none focus:ring-3 focus:ring-blue-600/15 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-500 aria-invalid:border-red-500 aria-invalid:hover:border-red-500 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500/15 sm:text-sm";

/** Alto fijo para input y select de una linea. */
export const controlHeightClassName = "h-9";
