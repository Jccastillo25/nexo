// Iconos de categoria para el App Launcher — ver
// docs/planning/NORMA_DISENO_UNIVERSAL.md. Trazo simple a mano (viewBox
// 20x20, stroke 1.75, sin relleno) en el mismo estilo que los iconos de
// ShellBar (buscador/campana) — a propósito sin depender de una libreria
// de iconos externa, para no agregarle esa dependencia a @nexo/ui.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function VentasIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 14.5 7 10l3 3 6.5-7.5" />
      <path d="M12.5 5h4v4" />
    </Icon>
  );
}

export function FinanzasIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5v7M12.2 8c0-1-1-1.6-2.2-1.6S7.8 7 7.8 8c0 2.1 4.4 1 4.4 3.1 0 1-1 1.6-2.2 1.6s-2.2-.6-2.2-1.6" />
    </Icon>
  );
}

export function CadenaSuministroIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 17 6.2v7.6L10 17.5 3 13.8V6.2L10 2.5Z" />
      <path d="M3 6.2 10 10l7-3.8M10 10v7.5" />
    </Icon>
  );
}

export function RrhhIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="2.4" />
      <path d="M2.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2" />
      <circle cx="14.3" cy="7.7" r="2" />
      <path d="M12.7 16c.1-2.1 1.7-3.7 4.1-3.7" />
    </Icon>
  );
}

export function ServiciosIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.7v2.1M10 15.2v2.1M17.3 10h-2.1M4.8 10H2.7M15 5l-1.5 1.5M6.5 13.5 5 15M15 15l-1.5-1.5M6.5 6.5 5 5" />
    </Icon>
  );
}

export function DefaultAppIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.3" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" />
    </Icon>
  );
}

export const CATEGORY_ICONS: Record<
  string,
  (props: IconProps) => React.JSX.Element
> = {
  Finanzas: FinanzasIcon,
  Ventas: VentasIcon,
  "Cadena de suministro": CadenaSuministroIcon,
  RRHH: RrhhIcon,
  Servicios: ServiciosIcon,
};

export function getCategoryIcon(
  category: string | null
): (props: IconProps) => React.JSX.Element {
  if (!category) return DefaultAppIcon;
  return CATEGORY_ICONS[category] ?? DefaultAppIcon;
}
