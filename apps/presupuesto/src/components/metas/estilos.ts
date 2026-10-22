// Lo que queda de las clases propias del módulo. Botones, campos, enlaces,
// listados y paginación ya salen del kit (@nexo/ui: Button, ButtonLink,
// Input, Select, Field, DataTable, Pagination). Quedan dos, con motivo:
//
// - claseTarjeta: la superficie de las secciones del Dashboard y de los
//   formularios. El kit todavía no tiene `Card` (pedido anotado); cuando lo
//   tenga, esto se reemplaza.
// - claseThead: el encabezado de las tablas que no pasan a DataTable a
//   propósito: las del Dashboard (su pirámide no se rediseña) y las editables
//   (Metas por vendedor y el reparto del Presupuesto anual).
export const claseTarjeta = "rounded-xl border border-neutral-200 bg-white shadow-sm";

export const claseThead = "bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
