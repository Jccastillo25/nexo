// Iconos a color por aplicación para el App Launcher (rediseño 2026-10-17,
// pedido del usuario: "que las apps se vean así" con captura de la grilla de
// Odoo). Formas planas en dos o tres tonos sobre un mosaico blanco. La clave
// es `core.apps.icon` (ticket, handshake, truck, package, users-round, sun);
// sin coincidencia cae al icono de la categoría y, en último caso, al genérico.
// Colores solo de la escala de Tailwind: es el único lugar donde una app tiene
// identidad de color propia (regla "una sola paleta", CLAUDE.md).
import type { ReactNode } from "react";

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

type AppIconComponent = (props: { className?: string }) => ReactNode;

/** Atención: ticket de turno. */
function TicketIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path
        className="fill-teal-500"
        d="M6 14a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v5a5 5 0 0 0 0 10v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-5a5 5 0 0 0 0-10z"
      />
      <path className="fill-teal-300" d="M30 10h8a4 4 0 0 1 4 4v5a5 5 0 0 0 0 10v5a4 4 0 0 1-4 4h-8z" />
      <rect className="fill-white" x="12" y="18" width="13" height="3" rx="1.5" />
      <rect className="fill-white" x="12" y="25" width="9" height="3" rx="1.5" />
      <circle className="fill-orange-400" cx="36" cy="24" r="3.5" />
    </Svg>
  );
}

/** CRM: embudo de ventas. */
function FunnelIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path className="fill-rose-500" d="M6 9h36l-5 8H11z" />
      <path className="fill-pink-400" d="M12 20h24l-5 8H17z" />
      <path className="fill-fuchsia-300" d="M18 31h12l-3 8h-6z" />
    </Svg>
  );
}

/** Flotilla: camión. */
function TruckIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect className="fill-blue-600" x="4" y="11" width="25" height="21" rx="3" />
      <path className="fill-sky-400" d="M29 18h8.5a3 3 0 0 1 2.5 1.3l3.5 5.2a3 3 0 0 1 .5 1.7V32H29z" />
      <path className="fill-white/70" d="M32 21h5l2.5 4H32z" />
      <circle className="fill-slate-700" cx="13" cy="35" r="5" />
      <circle className="fill-slate-700" cx="36" cy="35" r="5" />
      <circle className="fill-white" cx="13" cy="35" r="2" />
      <circle className="fill-white" cx="36" cy="35" r="2" />
    </Svg>
  );
}

/** Productos: caja en perspectiva. */
function BoxIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path className="fill-violet-300" d="M24 5 42 14 24 23 6 14z" />
      <path className="fill-purple-600" d="M6 14l18 9v20L6 34z" />
      <path className="fill-purple-400" d="M42 14 24 23v20l18-9z" />
      <path className="fill-amber-300" d="M14 9.5 32 18.5v6l-4 2v-6L10 11.5z" />
    </Svg>
  );
}

/** RRHH: dos personas. */
function PeopleIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle className="fill-orange-300" cx="33" cy="14" r="6" />
      <path className="fill-orange-300" d="M22 38c0-7 5-12 11-12s11 5 11 12z" />
      <circle className="fill-amber-500" cx="18" cy="16" r="7.5" />
      <path className="fill-amber-500" d="M4 42c0-8.5 6.3-14.5 14-14.5S32 33.5 32 42z" />
    </Svg>
  );
}

/** Agencia digital: sol / campaña. */
function SunIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g className="fill-amber-400">
        <rect x="22" y="2" width="4" height="9" rx="2" />
        <rect x="22" y="37" width="4" height="9" rx="2" />
        <rect x="2" y="22" width="9" height="4" rx="2" />
        <rect x="37" y="22" width="9" height="4" rx="2" />
        <rect x="8" y="8" width="4" height="9" rx="2" transform="rotate(-45 10 12.5)" />
        <rect x="36" y="31" width="4" height="9" rx="2" transform="rotate(-45 38 35.5)" />
        <rect x="36" y="8" width="4" height="9" rx="2" transform="rotate(45 38 12.5)" />
        <rect x="8" y="31" width="4" height="9" rx="2" transform="rotate(45 10 35.5)" />
      </g>
      <circle className="fill-indigo-500" cx="24" cy="24" r="10" />
      <circle className="fill-indigo-300" cx="27" cy="21" r="3.5" />
    </Svg>
  );
}

/** Configuración: engranaje. */
function GearIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle
        className="stroke-slate-600"
        cx="24"
        cy="24"
        r="13"
        fill="none"
        strokeWidth="7"
        strokeDasharray="5.1 5.1"
      />
      <circle className="fill-slate-600" cx="24" cy="24" r="11" />
      <circle className="fill-sky-400" cx="24" cy="24" r="5" />
    </Svg>
  );
}

/** Genérico: cuatro bloques. */
function GridIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect className="fill-sky-500" x="6" y="6" width="16" height="16" rx="4" />
      <rect className="fill-emerald-400" x="26" y="6" width="16" height="16" rx="4" />
      <rect className="fill-amber-400" x="6" y="26" width="16" height="16" rx="4" />
      <rect className="fill-rose-400" x="26" y="26" width="16" height="16" rx="4" />
    </Svg>
  );
}

const POR_ICONO: Record<string, AppIconComponent> = {
  ticket: TicketIcon,
  handshake: FunnelIcon,
  truck: TruckIcon,
  package: BoxIcon,
  "users-round": PeopleIcon,
  sun: SunIcon,
  settings: GearIcon,
};

const POR_CATEGORIA: Record<string, AppIconComponent> = {
  Ventas: FunnelIcon,
  "Cadena de suministro": BoxIcon,
  RRHH: PeopleIcon,
  Servicios: TicketIcon,
};

/** Icono a color de una app del Launcher: por `core.apps.icon`, luego por categoría. */
export function AppTileIcon({
  icon,
  category,
  className = "h-10 w-10",
}: {
  icon?: string | null;
  category?: string | null;
  className?: string;
}) {
  const Componente = (icon && POR_ICONO[icon]) || (category && POR_CATEGORIA[category]) || GridIcon;
  return <Componente className={className} />;
}
