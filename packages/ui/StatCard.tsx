// Tile de KPI — patron "KPI tile" de Fiori/Odoo (ver
// docs/planning/DISENO_UX_UI.md y ARQUITECTURA_MVP_ESCALABLE.md §4.2).
//
// Unifica lo que hasta 2026-09-02 existia 3 veces distinto entre
// RRHH/Flotilla (deuda senalada en el comentario original de
// apps/crm/src/app/(app)/dashboard/page.tsx, que a proposito se deja con
// su copia local — CRM sigue en paleta clara, tech debt reconocida, no se
// migra como parte de este cambio). Todo modulo NUEVO usa este StatCard,
// con `.nexo-glass`, no una copia local.
//
// No es "use client": no tiene estado ni interactividad, se puede usar
// directo desde un Server Component (ej. el dashboard de RRHH).

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  /** Color de acento opcional para el valor (ej. "text-red-400" cuando el
   * KPI representa algo que requiere atencion). Default: blanco/plata. */
  accentClassName?: string;
}

export function StatCard({ label, value, hint, accentClassName }: StatCardProps) {
  return (
    <div className="nexo-glass rounded-2xl px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          accentClassName ?? "text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}
