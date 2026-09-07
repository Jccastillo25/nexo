import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import FeriadosPanel, { type FeriadoRow } from "../jornadas/feriados-panel";

export const metadata: Metadata = {
  title: "Feriados · RRHH",
};

/**
 * Nexo Enterprise UI (2026-09-07): ruta propia para el calendario de
 * feriados (Contratación → Feriados en el arbol de navegacion) —
 * separada de /jornadas para reflejar la jerarquia pedida en el rediseño.
 * Mismo componente/actions/RLS de F1.4 (rrhh.feriados), sin cambios de
 * logica ni de DB: FeriadosPanel se reutiliza desde la carpeta jornadas/
 * en vez de duplicarlo.
 */
export default async function FeriadosPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVerFeriados, canCrearFeriados, canEliminarFeriados] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.asistencia.feriados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.feriados.crear"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.feriados.eliminar"),
  ]);

  let feriados: FeriadoRow[] = [];
  if (canVerFeriados) {
    const { data: feriadosData, error: feriadosError } = await supabase
      .schema("rrhh")
      .from("feriados")
      .select("id, fecha, nombre")
      .eq("company_id", companyId)
      .order("fecha");

    if (feriadosError) throw new Error(`No se pudieron cargar los feriados: ${feriadosError.message}`);
    feriados = feriadosData ?? [];
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Feriados" description="Calendario de días no laborables de la empresa." />

      {canVerFeriados ? (
        <FeriadosPanel feriados={feriados} canCrear={canCrearFeriados} canEliminar={canEliminarFeriados} />
      ) : (
        <EmptyState
          title="Sin permiso para ver feriados"
          description="No tenés el permiso rrhh.asistencia.feriados.ver."
        />
      )}
    </div>
  );
}
