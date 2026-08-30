// Tokens de color por categoria de modulo — ver
// docs/planning/DISENO_UX_UI.md seccion 2. Estilo Odoo: el color distingue
// la CATEGORIA (Finanzas, Ventas, Cadena de suministro...), no el modulo
// individual, para que se lea como una sola familia visual al crecer el
// catalogo de apps.

export type CategoryColor = {
  bg: string;
  text: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  Finanzas: { bg: "bg-green-100", text: "text-green-800" },
  Ventas: { bg: "bg-pink-100", text: "text-pink-800" },
  "Cadena de suministro": { bg: "bg-purple-100", text: "text-purple-800" },
  RRHH: { bg: "bg-amber-100", text: "text-amber-800" },
  Servicios: { bg: "bg-indigo-100", text: "text-indigo-800" },
};

export const DEFAULT_CATEGORY_COLOR: CategoryColor = {
  bg: "bg-neutral-100",
  text: "text-neutral-700",
};

export function getCategoryColor(category: string | null): CategoryColor {
  if (!category) return DEFAULT_CATEGORY_COLOR;
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}
