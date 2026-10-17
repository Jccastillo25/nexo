import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { consultarMarcas } from "./actions";
import { hoyManagua } from "./filtros";
import MarcasClient from "./marcas-client";

export const metadata: Metadata = { title: "Marcas · RRHH" };

export default async function MarcasPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  if (!await hasPermission({ supabase, companyId }, "rrhh.asistencia.marcas.ver")) {
    return <EmptyState title="Sin permiso para ver marcas" description="No tenés el permiso rrhh.asistencia.marcas.ver." />;
  }
  const hoy = hoyManagua();
  const initial = await consultarMarcas({ desde: hoy, hasta: hoy });
  return <div className="flex flex-col gap-6">
    <PageHeader title="Marcas" description="Entradas y salidas registradas. Hora de Nicaragua." />
    <MarcasClient hoy={hoy} initial={initial} />
  </div>;
}
