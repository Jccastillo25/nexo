// Punto de entrada del design system compartido de Nexo — "Nexo Enterprise
// UI" (rediseño 2026-09-07, tema claro por defecto). Ver
// docs/DESIGN_SYSTEM.md (regla obligatoria) y
// docs/planning/DISENO_UX_UI.md (investigacion original).
//
// AppShell/ShellBar/Sidebar/StatCard (tema oscuro/glass + dock flotante,
// vigentes desde 2026-08-30) quedaron retirados en este rediseño —
// NexoShell/NexoTopbar/NexoSidebar/MetricCard los sustituyen. Se verifico
// (grep de "@nexo/ui" en todo el monorepo, incluida apps/flotilla) que
// ningun consumidor fuera de apps/nexo, apps/rrhh y apps/crm los usaba —
// los tres se migraron en el mismo commit, no quedan referencias rotas.
//
// v2 (2026-10-20, Fases 1 y 2 de "Nexo Enterprise UI v2"): tokens a las
// variables de Tailwind v4 (un solo azul), theme.css, Button/ButtonLink/
// SubmitButton, Field/Input/Select/Textarea, Alert, Skeleton/PageSkeleton,
// ErrorState, Pagination, Tabs/TabLinks y formato.ts; MetricCard, PageHeader,
// EmptyState, DataTable, StatusBadge, Toast y el shell actualizados sin
// romper su API. formato.ts tambien se puede importar solo
// ("@nexo/ui/formato"), sin cargar los componentes (Nexo Mobile).
export { NexoShell } from "./NexoShell";
export type { NexoShellProps } from "./NexoShell";
export { NexoSidebar } from "./NexoSidebar";
export type { NexoSidebarProps } from "./NexoSidebar";
export { NexoTopbar } from "./NexoTopbar";
export type { NexoTopbarProps } from "./NexoTopbar";
export { resolveBreadcrumbTrail, isNavItemActive } from "./nexo-nav";
export type { NexoNavItem } from "./nexo-nav";
export { NexoIcon } from "./nexo-icons";
export type { NexoIconName } from "./nexo-icons";
export { BackToPanelLink } from "./BackToPanelLink";
export type { BackToPanelLinkProps } from "./BackToPanelLink";
export { Breadcrumb } from "./Breadcrumb";
export type { BreadcrumbItem, BreadcrumbProps } from "./Breadcrumb";
export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";
export { DashboardHero } from "./DashboardHero";
export type { DashboardHeroProps } from "./DashboardHero";
export { MetricCard } from "./MetricCard";
export type { MetricCardProps, MetricCardDelta } from "./MetricCard";
export { ActivityFeed } from "./ActivityFeed";
export type { ActivityFeedProps, ActivityItem } from "./ActivityFeed";
export { QuickActions } from "./QuickActions";
export type { QuickActionsProps, QuickAction } from "./QuickActions";
export { DataTable } from "./DataTable";
export type { DataTableProps, DataTableColumn } from "./DataTable";
export { RowActionsMenu } from "./RowActionsMenu";
export type { RowAction } from "./RowActionsMenu";
export { RowActionIcons } from "./RowActionIcons";
export type { RowIconAction, RowIconActionName } from "./RowActionIcons";
export { FilterBar } from "./FilterBar";
export type { FilterBarProps } from "./FilterBar";
export { StatusBadge } from "./StatusBadge";
export type { StatusBadgeProps, StatusTone } from "./StatusBadge";
export { FormTabs } from "./FormTabs";
export type { FormTabsProps, FormTab } from "./FormTabs";
export { Tabs, TabLinks } from "./Tabs";
export type { TabsProps, TabItem, TabLinksProps, TabLinkItem } from "./Tabs";
export { FormSection } from "./FormSection";
export type { FormSectionProps } from "./FormSection";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps, EmptyStateVariant } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";
export { Skeleton, PageSkeleton } from "./Skeleton";
export type { PageSkeletonProps } from "./Skeleton";
export { Alert } from "./Alert";
export type { AlertProps, AlertTone } from "./Alert";
export { Field, Input, Select, Textarea } from "./Field";
export type { FieldProps, InputProps, SelectProps, TextareaProps } from "./Field";
export { controlClassName, controlHeightClassName } from "./control-classes";
export { Pagination } from "./Pagination";
export type { PaginationProps } from "./Pagination";
export { fechaCorta, fechaHora, hora, moneda, entero, porcentaje, ZONA_HORARIA } from "./formato";
export type { Moneda, FechaEntrada } from "./formato";
export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";
export { ToastProvider, useToast } from "./Toast";
export type { ToastTone } from "./Toast";
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
export { AppTileIcon } from "./app-icons";
export {
  BULLET_ICONS,
  BULLET_ICON_NAMES,
  BulletIcon,
} from "./bullet-icons";
export type { BulletIconName } from "./bullet-icons";
export { Footer } from "./Footer";
export type { FooterProps } from "./Footer";
export { Button, ButtonLink, Spinner, buttonClassName } from "./Button";
export type { ButtonProps, ButtonLinkProps, ButtonVariant, ButtonSize, ButtonClassOptions } from "./Button";
export { SubmitButton } from "./SubmitButton";
export type { SubmitButtonProps } from "./SubmitButton";
