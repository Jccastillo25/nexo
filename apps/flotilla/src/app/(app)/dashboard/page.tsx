import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";

export const metadata: Metadata = {
  title: "Dashboard · Flotilla",
};

/**
 * Tablero de entregas (plan 22 §5.1). Las tarjetas de pendientes, programados,
 * en reparto, parciales e incidencias se calculan con el esquema de E2; hasta
 * entonces no hay fuente real y la regla de la suite prohíbe cifras de
 * ejemplo, así que se muestra el estado pendiente.
 */
export default async function DashboardPage() {
  const permisos = await permisosDe();

  if (!permisos.dashboard) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="Flotilla" />
        <EmptyState
          variant="no-access"
          title="Tu rol no incluye el tablero de entregas"
          description="Usa el menú para entrar a las funciones de tu rol."
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Entregas"
        description="Pendientes, recorridos del día, entregas parciales e incidencias."
      />
      <EmptyState
        variant="pending"
        title="Pendiente de integración"
        description="Los indicadores aparecen cuando existan órdenes de entrega en Nexo. Mientras tanto no se muestran cifras."
      />
    </div>
  );
}
