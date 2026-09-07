import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import ContratosPanel, {
  type ContratoRow,
  type CredencialEstado,
  type JornadaOption,
  type JornadaVigente,
} from "./contratos-panel";
import { verEstadoCredencial } from "./actions";

export const metadata: Metadata = {
  title: "Expediente · RRHH",
};

/**
 * F1.2/F1.3 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): ficha
 * de un empleado — Expediente General (F1.1, arriba) + Expediente
 * Laboral (contratos + credencial de asistencia, F1.2/F1.3, abajo).
 * Todos los guards de recurso son UX (norma v3.0 paso 4) — la proteccion
 * real vive en RLS y en los RPC rrhh.fn_crear_contrato/fn_editar_contrato/
 * fn_activar_contrato/fn_finalizar_contrato/fn_regenerar_pin_contrato/
 * fn_estado_credencial_contrato.
 */
export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [
    canVer,
    canVerContratos,
    canCrear,
    canEditar,
    canActivar,
    canFinalizar,
    canVerSalario,
    canEditarSalario,
    canVerCredenciales,
    canRegenerarPin,
    canVerTurnos,
  ] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.activar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.finalizar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.credenciales.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.credenciales.regenerar"),
    // F1.4: rrhh.jornadas usa el mismo permiso que la plantilla de turnos
    // (ver docs/PERMISSIONS.md / migración 20260907162904) -- hoy solo
    // admin/supervisor_asistencia lo tienen, NO gestor_expedientes. Es un
    // gap conocido para el flujo "gestor_expedientes completa jornada del
    // contrato" -- ver nota en el reporte de cierre de F1.4. Mientras no
    // se apruebe extender el permiso, gestor_expedientes puede seguir
    // asignando por RPC (tiene contratos.editar) pero no ve el listado
    // para elegir -- el selector queda vacío para ese rol.
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.ver"),
  ]);

  if (!canVer) {
    return (
      <div className="nexo-glass rounded-2xl px-6 py-10 text-center text-sm text-white/60">
        No tenés el permiso <code className="text-white/80">rrhh.expedientes.empleados.ver</code>{" "}
        para ver esta sección.
      </div>
    );
  }

  const { data: empleado, error: empleadoError } = await supabase
    .schema("rrhh")
    .from("empleados")
    .select("id, codigo_empleado, nombre, apellido, documento_identidad, email, telefono")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (empleadoError) {
    throw new Error(`No se pudo cargar el expediente: ${empleadoError.message}`);
  }
  if (!empleado) {
    notFound();
  }

  let contratos: ContratoRow[] = [];
  if (canVerContratos) {
    const { data: contratosData, error: contratosError } = await supabase
      .schema("rrhh")
      .from("contratos")
      .select(
        "id, numero_contrato, estado, puesto, departamento, modalidad_contrato, fecha_inicio, fecha_fin_prevista, fecha_fin_real"
      )
      .eq("empleado_id", id)
      .eq("company_id", companyId)
      .order("numero_contrato", { ascending: false });

    if (contratosError) {
      throw new Error(`No se pudo cargar el expediente laboral: ${contratosError.message}`);
    }

    let salarios = new Map<string, number>();
    if (canVerSalario && contratosData && contratosData.length > 0) {
      const { data: compensaciones } = await supabase
        .schema("rrhh")
        .from("contrato_compensacion")
        .select("contrato_id, salario_base")
        .in(
          "contrato_id",
          contratosData.map((c) => c.id)
        );
      salarios = new Map((compensaciones ?? []).map((c) => [c.contrato_id, c.salario_base]));
    }

    contratos = (contratosData ?? []).map((c) => ({
      ...c,
      salario_base: salarios.get(c.id) ?? null,
    }));
  }

  // F1.3: estado de la credencial del contrato activo, si hay uno.
  // "ver" es exclusivamente estado — verEstadoCredencial nunca devuelve
  // el PIN (rrhh.fn_estado_credencial_contrato ni siquiera lo selecciona).
  let credencial: CredencialEstado | null = null;
  if (canVerCredenciales) {
    const activo = contratos.find((c) => c.estado === "activo");
    if (activo) {
      const res = await verEstadoCredencial(activo.id);
      if (res.ok) {
        credencial = {
          tieneCredencial: res.tieneCredencial ?? false,
          activo: res.activo ?? false,
          pinBloqueado: res.pinBloqueado ?? false,
          rotacionNumero: res.rotacionNumero ?? 0,
        };
      }
    }
  }

  // F1.4: jornadas activas disponibles para asignar + la jornada vigente
  // (fila abierta, vigente_hasta is null) de cada contrato no finalizado.
  // Sin RPC dedicado de lectura acá -- select directo protegido por RLS
  // (rrhh.jornadas.ver / rrhh.contrato_jornadas.ver), mismo criterio que
  // el resto de esta página.
  let jornadasDisponibles: JornadaOption[] = [];
  const jornadaVigentePorContrato: Record<string, JornadaVigente> = {};
  if (canVerTurnos && canVerContratos && contratos.length > 0) {
    const { data: jornadasData } = await supabase
      .schema("rrhh")
      .from("jornadas")
      .select("id, nombre")
      .eq("company_id", companyId)
      .eq("activo", true)
      .order("nombre");
    jornadasDisponibles = jornadasData ?? [];

    const contratosNoFinalizados = contratos.filter((c) => c.estado !== "finalizado").map((c) => c.id);
    if (contratosNoFinalizados.length > 0) {
      const { data: vigentesData } = await supabase
        .schema("rrhh")
        .from("contrato_jornadas")
        .select("contrato_id, jornada_id, vigente_desde, jornadas(nombre)")
        .in("contrato_id", contratosNoFinalizados)
        .is("vigente_hasta", null);

      for (const v of vigentesData ?? []) {
        const jornadaNombre = (v as unknown as { jornadas: { nombre: string } | null }).jornadas?.nombre;
        jornadaVigentePorContrato[v.contrato_id] = {
          jornadaId: v.jornada_id,
          jornadaNombre: jornadaNombre ?? "(jornada eliminada)",
          vigenteDesde: v.vigente_desde,
        };
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/expedientes" className="text-sm text-white/50 hover:text-white">
          ← Expedientes
        </Link>
      </div>

      <div className="nexo-glass rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-white">
          {empleado.nombre} {empleado.apellido}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          #{empleado.codigo_empleado} · {empleado.documento_identidad ?? "sin documento"}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/60">
          <span>{empleado.email ?? "sin correo"}</span>
          <span>{empleado.telefono ?? "sin teléfono"}</span>
        </div>
      </div>

      {canVerContratos ? (
        <ContratosPanel
          empleadoId={id}
          contratos={contratos}
          credencial={credencial}
          jornadasDisponibles={jornadasDisponibles}
          jornadaVigentePorContrato={jornadaVigentePorContrato}
          canCrear={canCrear}
          canEditar={canEditar}
          canActivar={canActivar}
          canFinalizar={canFinalizar}
          canVerSalario={canVerSalario}
          canEditarSalario={canEditarSalario}
          canVerCredenciales={canVerCredenciales}
          canRegenerarPin={canRegenerarPin}
        />
      ) : (
        <div className="nexo-glass rounded-2xl px-6 py-8 text-center text-sm text-white/60">
          No tenés el permiso <code className="text-white/80">rrhh.expedientes.contratos.ver</code>{" "}
          para ver el expediente laboral.
        </div>
      )}
    </div>
  );
}
