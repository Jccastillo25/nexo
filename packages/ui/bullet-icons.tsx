// Set de iconos para los bullets del login (ver
// apps/nexo/src/app/login/page.tsx y apps/nexo/src/app/ajustes) — mismo
// registro por-nombre que packages/ui/Sidebar.tsx (no por referencia a
// componente): el valor persistido en core.platform_settings.bullets es
// un string (`icon`), asi viaja sin problema por JSON/DB, y ademas permite
// poblar un <select> en el editor sin importar componentes ahi.
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

function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 16 5v5c0 4-2.6 6.6-6 7.5-3.4-.9-6-3.5-6-7.5V5l6-2.5Z" />
      <path d="M7.3 10 9.2 12l3.5-4" />
    </Icon>
  );
}

function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="10" r="3.2" />
      <path d="M9.8 10h7.7M14.5 10v3M17 10v2.3" />
    </Icon>
  );
}

function LayersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3 17 7l-7 4-7-4 7-4Z" />
      <path d="M3 10.5 10 14.5 17 10.5M3 14 10 18l7-4" />
    </Icon>
  );
}

function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M6.8 10.2 8.8 12.2 13.3 7.7" />
    </Icon>
  );
}

function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.7l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L10 2.7Z" />
    </Icon>
  );
}

export const BULLET_ICONS = {
  shield: ShieldIcon,
  key: KeyIcon,
  layers: LayersIcon,
  check: CheckIcon,
  star: StarIcon,
} as const;

export type BulletIconName = keyof typeof BULLET_ICONS;

export const BULLET_ICON_NAMES = Object.keys(
  BULLET_ICONS
) as BulletIconName[];

export function BulletIcon({
  name,
  ...props
}: IconProps & { name?: string }) {
  const Cmp =
    BULLET_ICONS[(name as BulletIconName) ?? "shield"] ?? ShieldIcon;
  return <Cmp {...props} />;
}
