// Punto de entrada del design system compartido de Nexo.
// Ver docs/DESIGN_SYSTEM.md (regla obligatoria) y docs/planning/DISENO_UX_UI.md (investigacion).
export { ShellBar } from "./ShellBar";
export type { ShellBarProps } from "./ShellBar";
export { BackToPanelLink } from "./BackToPanelLink";
export type { BackToPanelLinkProps } from "./BackToPanelLink";
export { Sidebar } from "./Sidebar";
export type { SidebarProps, SidebarItem, SidebarIconName } from "./Sidebar";
export { AppShell } from "./AppShell";
export type { AppShellProps } from "./AppShell";
export { StatCard } from "./StatCard";
export type { StatCardProps } from "./StatCard";
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
export {
  BULLET_ICONS,
  BULLET_ICON_NAMES,
  BulletIcon,
} from "./bullet-icons";
export type { BulletIconName } from "./bullet-icons";
export { Footer } from "./Footer";
export type { FooterProps } from "./Footer";

// Pendiente: PageHeader.
