import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";

export const metadata: Metadata = {
  title: "Planillas · RRHH",
};

/**
 * Placeholder de ruta — mismo criterio que expedientes/page.tsx: este
 * turno construyo estructura + Kiosco, el motor de planillas (que lee de
 * rrhh.parametros_ley, ver 20260902000008) queda para un turno aparte.
 *
 * Nexo Enterprise UI (2026-09-07): placeholder historico conservado tal
 * cual (ajuste obligatorio del rediseño) — solo restyle a tema claro.
 */
export default function PlanillasPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Planillas" />
      <EmptyState
        title="Motor de planillas — pendiente de construir en un turno aparte"
        description="Lee de rrhh.parametros_ley y respeta modalidad_contrato."
      />
    </div>
  );
}
