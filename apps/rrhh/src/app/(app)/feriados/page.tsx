import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import FeriadosPanel, { type FeriadoRow } from "../jornadas/feriados-panel";

export const metadata: Metadata = {
  title: "Feriados · RRHH",
};

/**
 * Nexo Enterprise UI (2026-09-07): ruta propia para el calendario de
 * feriados (Contratación → Feriados en el arbol de navegacion). Mismo
 * componente/actions/RLS de F1.4 (rrhh.feriados): FeriadosPanel se
 * reutiliza desde la carpeta jornadas/ en vez de duplicarlo.
 */
export default async function FeriadosPage() {
  const { supabase, companyId } = await contextoActual<Database>();
  // Feriados en paralelo con los permisos (la RLS los protege igual).
  const [permisos, feriadosRes] = await Promise.all([
    permisosDe(),
    supabase.schema("rrhh").from("feriados").select("id, fecha, nombre").eq("company_id", companyId).order("fecha"),
  ]);

  if (!permisos.feriadosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Feriados" />
        <EmptyState variant="no-access" title="No tienes acceso a los feriados" />
      </div>
    );
  }

  if (feriadosRes.error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("feriados: listado", feriadosRes.error);
    throw new Error("No se pudieron cargar los feriados.");
  }
  const feriados: FeriadoRow[] = feriadosRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Feriados" description="Calendario de días no laborables de la empresa." />
      <FeriadosPanel
        feriados={feriados}
        canCrear={permisos.feriadosCrear}
        canEliminar={permisos.feriadosEliminar}
      />
    </div>
  );
}
