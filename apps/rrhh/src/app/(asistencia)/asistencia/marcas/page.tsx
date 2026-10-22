import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosAsistencia } from "@/lib/permisos-asistencia";
import { hoyManagua } from "@/lib/fecha-managua";
import { leerMarcas } from "./consulta";
import MarcasClient from "./marcas-client";

export const metadata: Metadata = { title: "Marcas · Asistencia" };

const TITULO = "Marcas";
const DESCRIPCION = "Entradas, descansos y salidas registradas. Hora de Nicaragua.";

// Movida desde (app)/marcas (2026-10-17) al separar Asistencia de RRHH:
// mismo contenido y la misma RPC (public.consultar_marcas). El permiso sale de
// la lista cacheada del request (la misma que pidió el layout): no hay otra
// consulta de permisos en la carga.
export default async function MarcasPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosAsistencia()]);
  if (!permisos.marcasVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={TITULO} description={DESCRIPCION} />
        <EmptyState variant="no-access" title="No tienes acceso a las marcas" />
      </div>
    );
  }
  const hoy = hoyManagua();
  const initial = await leerMarcas(supabase, companyId, { desde: hoy, hasta: hoy });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={TITULO} description={DESCRIPCION} />
      <MarcasClient hoy={hoy} initial={initial} />
    </div>
  );
}
