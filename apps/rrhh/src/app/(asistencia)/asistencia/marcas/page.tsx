import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P_ASISTENCIA } from "@/lib/permisos-asistencia";
import { consultarMarcas } from "./actions";
import { hoyManagua } from "@/lib/fecha-managua";
import MarcasClient from "./marcas-client";

export const metadata: Metadata = { title: "Marcas · Asistencia" };

// Movida desde (app)/marcas (2026-10-17) al separar Asistencia de RRHH:
// mismo contenido y la misma RPC (public.consultar_marcas).
export default async function MarcasPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  if (!await hasPermission({ supabase, companyId }, P_ASISTENCIA.marcasVer)) {
    return <div className="flex flex-col gap-6">
      <PageHeader title="Marcas" description="Entradas, descansos y salidas registradas. Hora de Nicaragua." />
      <EmptyState title="No tienes acceso a las marcas" description="Tu rol no permite consultar las marcas. Pide acceso a tu administrador." />
    </div>;
  }
  const hoy = hoyManagua();
  const initial = await consultarMarcas({ desde: hoy, hasta: hoy });
  return <div className="flex flex-col gap-6">
    <PageHeader title="Marcas" description="Entradas, descansos y salidas registradas. Hora de Nicaragua." />
    <MarcasClient hoy={hoy} initial={initial} />
  </div>;
}
