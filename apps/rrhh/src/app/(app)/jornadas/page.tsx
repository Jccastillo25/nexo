import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import JornadasPanel, { type JornadaDiaRow, type JornadaRow } from "./jornadas-panel";

export const metadata: Metadata = {
  title: "Jornadas · RRHH",
};

/**
 * F1.4 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): plantillas
 * de jornada (rrhh.jornadas/rrhh.jornada_dias) — esta pagina administra el
 * catalogo reutilizable, no el historico por contrato. Todos los guards de
 * recurso son UX (norma v3.0 paso 4) -- la proteccion real vive en RLS.
 *
 * Nexo Enterprise UI (2026-09-07): el calendario de feriados vive en su
 * propia ruta (/feriados). La asignacion de una jornada a un contrato vive
 * en Contratación → Contratos → ficha del contrato.
 */
export default async function JornadasPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.turnosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Jornadas" />
        <EmptyState variant="no-access" title="No tienes acceso a las jornadas" />
      </div>
    );
  }

  const { data: jornadasData, error: jornadasError } = await supabase
    .schema("rrhh")
    .from("jornadas")
    .select("id, nombre, descripcion, activo")
    .eq("company_id", companyId)
    .order("nombre");

  if (jornadasError) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("jornadas: listado", jornadasError);
    throw new Error("No se pudieron cargar las jornadas.");
  }
  const jornadas: JornadaRow[] = jornadasData ?? [];

  const diasPorJornada: Record<string, JornadaDiaRow[]> = {};
  if (jornadas.length > 0) {
    const { data: diasData, error: diasError } = await supabase
      .schema("rrhh")
      .from("jornada_dias")
      .select(
        "jornada_id, dia_semana, laborable, hora_entrada, hora_salida, minutos_descanso, tolerancia_entrada_min, tolerancia_salida_min"
      )
      .in(
        "jornada_id",
        jornadas.map((j) => j.id)
      );

    if (diasError) {
      console.error("jornadas: días", diasError);
      throw new Error("No se pudieron cargar los días de las jornadas.");
    }

    for (const d of diasData ?? []) {
      (diasPorJornada[d.jornada_id] ??= []).push(d);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jornadas"
        description="Crea y administra las plantillas de horario que usan los contratos."
      />
      <JornadasPanel
        jornadas={jornadas}
        diasPorJornada={diasPorJornada}
        canCrear={permisos.turnosCrear}
        canEditar={permisos.turnosEditar}
        canEliminar={permisos.turnosEliminar}
      />
    </div>
  );
}
