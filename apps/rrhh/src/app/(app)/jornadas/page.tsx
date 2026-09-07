import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import JornadasPanel, { type JornadaDiaRow, type JornadaRow } from "./jornadas-panel";

export const metadata: Metadata = {
  title: "Jornadas · RRHH",
};

/**
 * F1.4 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): plantillas
 * de jornada (rrhh.jornadas/rrhh.jornada_dias). La asignacion de una
 * jornada a un contrato especifico vive en el expediente del empleado
 * (/expedientes/[id]), no aca -- esta pagina administra el catalogo
 * reutilizable, no el historico por contrato. Todos los guards de recurso
 * son UX (norma v3.0 paso 4) -- la proteccion real vive en RLS.
 *
 * Nexo Enterprise UI (2026-09-07): el calendario de feriados se separo a
 * su propia ruta (/feriados) para reflejar el arbol de navegacion
 * Contratación → Jornadas / Feriados — mismos datos/RPC de siempre, sin
 * cambios de logica ni de DB.
 */
export default async function JornadasPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVerTurnos, canCrearTurnos, canEditarTurnos, canEliminarTurnos] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.eliminar"),
  ]);

  let jornadas: JornadaRow[] = [];
  let diasPorJornada: Record<string, JornadaDiaRow[]> = {};
  if (canVerTurnos) {
    const { data: jornadasData, error: jornadasError } = await supabase
      .schema("rrhh")
      .from("jornadas")
      .select("id, nombre, descripcion, activo")
      .eq("company_id", companyId)
      .order("nombre");

    if (jornadasError) throw new Error(`No se pudieron cargar las jornadas: ${jornadasError.message}`);
    jornadas = jornadasData ?? [];

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

      if (diasError) throw new Error(`No se pudieron cargar los días de jornada: ${diasError.message}`);

      diasPorJornada = {};
      for (const d of diasData ?? []) {
        (diasPorJornada[d.jornada_id] ??= []).push(d);
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Jornadas"
        description="Plantillas de horario reutilizables. Asignar una jornada a un contrato específico se hace desde el expediente del empleado."
      />

      {canVerTurnos ? (
        <JornadasPanel
          jornadas={jornadas}
          diasPorJornada={diasPorJornada}
          canCrear={canCrearTurnos}
          canEditar={canEditarTurnos}
          canEliminar={canEliminarTurnos}
        />
      ) : (
        <EmptyState
          title="Sin permiso para ver jornadas"
          description="No tenés el permiso rrhh.asistencia.turnos.ver."
        />
      )}
    </div>
  );
}
