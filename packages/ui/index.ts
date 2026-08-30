// Punto de entrada del design system compartido de Nexo.
// Ver docs/planning/DISENO_UX_UI.md.
export { ShellBar } from "./ShellBar";
export type { ShellBarProps } from "./ShellBar";
export {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  getCategoryColor,
} from "./category-colors";
export type { CategoryColor } from "./category-colors";

// Pendiente: StatCard, PageHeader — se construyen cuando RRHH/Flotilla se
// adapten y haya que resolver la duplicacion de StatCard que ya existe
// hoy en Gestor360 (3 implementaciones distintas).
