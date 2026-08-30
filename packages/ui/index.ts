// Punto de entrada del design system compartido de Nexo.
// Ver docs/DESIGN_SYSTEM.md (regla obligatoria) y docs/planning/DISENO_UX_UI.md (investigacion).
export { ShellBar } from "./ShellBar";
export type { ShellBarProps } from "./ShellBar";
export { BackToPanelLink } from "./BackToPanelLink";
export type { BackToPanelLinkProps } from "./BackToPanelLink";
export { Sidebar } from "./Sidebar";
export type { SidebarProps, SidebarItem } from "./Sidebar";
export {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  getCategoryColor,
} from "./category-colors";
export type { CategoryColor } from "./category-colors";
export {
  CATEGORY_ICONS,
  getCategoryIcon,
  VentasIcon,
  FinanzasIcon,
  CadenaSuministroIcon,
  RrhhIcon,
  ServiciosIcon,
  DefaultAppIcon,
} from "./category-icons";

// Pendiente: StatCard, PageHeader — se construyen cuando RRHH/Flotilla se
// adapten y haya que resolver la duplicacion de StatCard que ya existe
// hoy en Gestor360 (3 implementaciones distintas).
