import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { primeraPantallaPermitida } from "@/lib/planilla/rutas";

export const metadata: Metadata = {
  title: "Planilla · RRHH",
};

/**
 * Entrada de Planilla (B0): sin pantalla propia. Redirige a la primera que
 * el rol puede abrir (resumen → novedades → vacaciones → préstamos →
 * liquidaciones → régimen → declaraciones → parámetros → conceptos). Los
 * KPIs viven en /planillas/resumen para que ningún ítem del menú sea prefijo
 * de otro (el sidebar marca activo por prefijo).
 *
 * Sin ninguno de esos permisos muestra el acceso denegado aquí mismo (nunca
 * redirige a sí misma).
 */
export default async function PlanillasPage() {
  const permisos = await permisosDe();
  const destino = primeraPantallaPermitida(permisos);
  if (destino) redirect(destino);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Planilla" />
      <EmptyState
        variant="no-access"
        title="Tu rol no tiene acceso a Planilla"
        description="Pide los permisos de Planilla a quien administra Nexo."
      />
    </div>
  );
}
