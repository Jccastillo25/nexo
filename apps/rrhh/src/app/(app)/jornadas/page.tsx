import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import JornadasPanel, { type JornadaDiaRow, type JornadaRow } from "./jornadas-panel";
import FeriadosPanel, { type FeriadoRow } from "./feriados-panel";

export const metadata: Metadata = {
  title: "Jornadas · RRHH",
};

/**
 * F1.4 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): plantillas
 * de jornada (rrhh.jornadas/rrhh.jornada_dias) y calendario de feriados
 * (rrhh.feriados). La asignacion de una jornada a un contrato especifico
 * vive en el expediente del empleado (/expedientes/[id]), no aca -- esta
 * pagina administra el catalogo reutilizable, no el historico por
 * contrato. Todos los guards de recurso son UX (norma v3.0 paso 4) -- la
 * proteccion real vive en RLS (rrhh.jornadas/jornada_dias/feriados,
 * gateadas por core.has_permission()).
 */
export default async function JornadasPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [
    canVerTurnos,
    canCrearTurnos,
    canEditarTurnos,
    canEliminarTurnos,
    canVerFeriados,
    canCrearFeriados,
    canEliminarFeriados,
  ] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.eliminar"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.feriados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.feriados.crear"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.feriados.eliminar"),
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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Jornadas</h1>
        <p className="mt-1 text-sm text-white/50">
          Plantillas de horario y calendario de feriados. Asignar una jornada a un contrato específico se
          hace desde el expediente del empleado.
        </p>
      </div>

      {canVerTurnos ? (
        <JornadasPanel
          jornadas={jornadas}
          diasPorJornada={diasPorJornada}
          canCrear={canCrearTurnos}
          canEditar={canEditarTurnos}
          canEliminar={canEliminarTurnos}
        />
      ) : (
        <div className="nexo-glass rounded-2xl px-6 py-8 text-center text-sm text-white/60">
          No tenés el permiso <code className="text-white/80">rrhh.asistencia.turnos.ver</code> para ver
          jornadas.
        </div>
      )}

      {canVerFeriados ? (
        <FeriadosPanel feriados={feriados} canCrear={canCrearFeriados} canEliminar={canEliminarFeriados} />
      ) : (
        <div className="nexo-glass rounded-2xl px-6 py-8 text-center text-sm text-white/60">
          No tenés el permiso <code className="text-white/80">rrhh.asistencia.feriados.ver</code> para ver
          feriados.
        </div>
      )}
    </div>
  );
}
