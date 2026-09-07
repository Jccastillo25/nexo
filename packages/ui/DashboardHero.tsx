// Bloque de bienvenida del dashboard "Torre de Control" (pedido explicito
// del rediseño Nexo Enterprise UI, 2026-09-07): "Bienvenido, {usuario}" +
// resumen operativo. Server Component, sin estado.
export interface DashboardHeroProps {
  greeting: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function DashboardHero({ greeting, subtitle, children }: DashboardHeroProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-6 text-white shadow-sm">
      <div>
        <p className="text-lg font-semibold">{greeting}</p>
        {subtitle && <p className="mt-1 text-sm text-blue-100">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
