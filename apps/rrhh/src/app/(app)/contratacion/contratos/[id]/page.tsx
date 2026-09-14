import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import ContratoFicha, {
  type CredencialEstado,
  type JornadaOption,
  type JornadaVigente,
} from "./contrato-ficha";

export const metadata: Metadata = {
  title: "Contrato · RRHH",
};

/**
 * Ficha de UN contrato (Contratación → Contratos → 👁/✎) — dueña del
 * ciclo de vida COMPLETO del contrato (P2/P3, reconciliación de
 * navegación 2026-09-14, ver docs/status-log/): crear (ver
 * contratacion/contratos/nuevo), editar datos base, asignar jornada,
 * activar (genera PIN), regenerar PIN, finalizar. Antes este ciclo vivía
 * repartido entre /expedientes/[id] (activar/finalizar/PIN) y esta
 * página (solo editar/jornada) — ya no: una sola implementación
 * (contratacion/contratos/actions.ts), un solo lugar de gestión. El
 * expediente del empleado (/expedientes/[id]) ya no tiene ninguna
 * acción ni dato contractual.
 */
export default async function ContratoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [
    canVer,
    canEditar,
    canActivar,
    canFinalizar,
    canVerSalario,
    canEditarSalario,
    canVerCredenciales,
    canRegenerarPin,
    canVerTurnos,
  ] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.activar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.finalizar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.credenciales.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.credenciales.regenerar"),
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

  const [compensacionRes, jornadasCatalogoRes, vigenteRes, credencialRes] = await Promise.all([
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
    // F1.3: estado de la credencial, solo tiene sentido para un contrato
    // activo (los demas nunca tuvieron/ya perdieron su PIN).
    canVerCredenciales && contrato.estado === "activo"
      ? supabase.rpc("estado_credencial_contrato", { p_contrato_id: id, p_company_id: companyId })
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

  const credencialRow = (credencialRes.data as
    | { tiene_credencial: boolean; activo: boolean; pin_bloqueado: boolean; rotacion_numero: number }[]
    | null)?.[0];
  const credencial: CredencialEstado | null = credencialRow
    ? {
        tieneCredencial: credencialRow.tiene_credencial,
        activo: credencialRow.activo,
        pinBloqueado: credencialRow.pin_bloqueado,
        rotacionNumero: credencialRow.rotacion_numero,
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
        canActivar={canActivar}
        canFinalizar={canFinalizar}
        canVerSalario={canVerSalario}
        canEditarSalario={canEditarSalario}
        canVerCredenciales={canVerCredenciales}
        canRegenerarPin={canRegenerarPin}
        canVerTurnos={canVerTurnos}
        credencial={credencial}
        jornadasDisponibles={jornadasDisponibles}
        jornadaVigente={jornadaVigente}
      />
    </div>
  );
}
