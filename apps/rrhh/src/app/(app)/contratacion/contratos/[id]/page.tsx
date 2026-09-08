import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import ContratoFicha, { type JornadaOption, type JornadaVigente } from "./contrato-ficha";

export const metadata: Metadata = {
  title: "Contrato · RRHH",
};

/**
 * Ficha de UN contrato (Contratación → Contratos → 👁/✎) — nueva ruta
 * mínima (2026-09-08, ver docs/IMPLEMENTATION_STATUS.md) para separar
 * "ver/editar un contrato puntual" de "ir al expediente del empleado".
 * Reutiliza exactamente las mismas queries/RPC/permisos que ya existían en
 * /expedientes/[id] para esta sección — sin lógica de negocio nueva. El
 * ciclo de vida completo (crear/activar/finalizar/regenerar PIN) sigue
 * viviendo únicamente en el expediente del empleado, sin cambios.
 */
export default async function ContratoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canEditar, canVerSalario, canEditarSalario, canVerTurnos] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.editar"),
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.ver"),
  ]);

  if (!canVer) {
    return (
      <EmptyState
        title="Sin permiso para ver este contrato"
        description="No tenés el permiso rrhh.expedientes.contratos.ver para esta empresa."
      />
    );
  }

  const { data: contrato, error: contratoError } = await supabase
    .schema("rrhh")
    .from("contratos")
    .select(
      "id, empleado_id, numero_contrato, estado, puesto, departamento, modalidad_contrato, fecha_inicio, fecha_fin_prevista, fecha_fin_real, empleados(nombre, apellido)"
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (contratoError) {
    throw new Error(`No se pudo cargar el contrato: ${contratoError.message}`);
  }
  if (!contrato) {
    notFound();
  }

  const empleado = contrato.empleados as unknown as { nombre: string; apellido: string } | null;

  const [compensacionRes, jornadasCatalogoRes, vigenteRes] = await Promise.all([
    canVerSalario
      ? supabase
          .schema("rrhh")
          .from("contrato_compensacion")
          .select("salario_base")
          .eq("contrato_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canVerTurnos
      ? supabase
          .schema("rrhh")
          .from("jornadas")
          .select("id, nombre")
          .eq("company_id", companyId)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: null }),
    canVerTurnos
      ? supabase
          .schema("rrhh")
          .from("contrato_jornadas")
          .select("jornada_id, vigente_desde, jornadas(nombre)")
          .eq("contrato_id", id)
          .is("vigente_hasta", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const salarioBase =
    (compensacionRes.data as { salario_base: number } | null)?.salario_base ?? null;
  const jornadasDisponibles: JornadaOption[] = jornadasCatalogoRes.data ?? [];
  const vigenteRow = vigenteRes.data as
    | { jornada_id: string; vigente_desde: string; jornadas: { nombre: string } | null }
    | null;
  const jornadaVigente: JornadaVigente | null = vigenteRow
    ? {
        jornadaNombre: vigenteRow.jornadas?.nombre ?? "(jornada eliminada)",
        vigenteDesde: vigenteRow.vigente_desde,
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Contrato #${contrato.numero_contrato}`}
        description={
          empleado ? (
            <>
              Empleado:{" "}
              <Link href={`/expedientes/${contrato.empleado_id}`} className="text-blue-700 hover:underline">
                {empleado.nombre} {empleado.apellido}
              </Link>
            </>
          ) : undefined
        }
      />

      <ContratoFicha
        contrato={{
          id: contrato.id,
          empleadoId: contrato.empleado_id,
          numeroContrato: contrato.numero_contrato,
          estado: contrato.estado,
          puesto: contrato.puesto,
          departamento: contrato.departamento,
          modalidadContrato: contrato.modalidad_contrato,
          fechaInicio: contrato.fecha_inicio,
          fechaFinPrevista: contrato.fecha_fin_prevista,
          fechaFinReal: contrato.fecha_fin_real,
          salarioBase,
        }}
        canEditar={canEditar}
        canVerSalario={canVerSalario}
        canEditarSalario={canEditarSalario}
        canVerTurnos={canVerTurnos}
        jornadasDisponibles={jornadasDisponibles}
        jornadaVigente={jornadaVigente}
      />
    </div>
  );
}
