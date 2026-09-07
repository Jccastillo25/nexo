import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, FormTabs, PageHeader } from "@nexo/ui";
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
 * de un empleado — Expediente General (F1.1, pestaña "Datos personales") +
 * Expediente Laboral (contratos + credencial de asistencia, F1.2/F1.3,
 * seccion aparte abajo — perfil y contrato son procesos separados, regla
 * obligatoria del rediseño §1.7). Todos los guards de recurso son UX
 * (norma v3.0 paso 4) — la proteccion real vive en RLS y en los RPC
 * rrhh.fn_crear_contrato/fn_editar_contrato/fn_activar_contrato/
 * fn_finalizar_contrato/fn_regenerar_pin_contrato/
 * fn_estado_credencial_contrato.
 *
 * Nexo Enterprise UI (2026-09-07): el perfil ampliado (Dirección con
 * catálogo Nicaragua, Información complementaria, Cuentas bancarias,
 * Beneficiario, Documentos) queda deliberadamente FUERA de este commit —
 * requiere tablas/Storage/permisos que todavía no existen (ver
 * docs/RRHH_MVP.md §14 y la regla explícita del rediseño de no meter
 * schema nuevo en el commit visual). Las pestañas quedan preparadas con
 * EmptyState explicando por qué, no con datos inventados.
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
    // admin/supervisor_asistencia lo tienen, NO gestor_expedientes. Gap
    // conocido, pendiente de aprobación aparte (ver IMPLEMENTATION_STATUS.md).
    hasPermission({ supabase, companyId }, "rrhh.asistencia.turnos.ver"),
  ]);

  if (!canVer) {
    return (
      <EmptyState
        title="Sin permiso para ver este expediente"
        description="No tenés el permiso rrhh.expedientes.empleados.ver para esta empresa."
      />
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
      <PageHeader
        title={`${empleado.nombre} ${empleado.apellido}`}
        description={`#${empleado.codigo_empleado} · ${empleado.documento_identidad ?? "sin documento"}`}
      />

      <FormTabs
        tabs={[
          { key: "personales", label: "Datos personales" },
          { key: "direccion", label: "Dirección", disabled: true },
          { key: "complementaria", label: "Información complementaria", disabled: true },
          { key: "bancarias", label: "Cuentas bancarias", disabled: true },
          { key: "beneficiario", label: "Beneficiario", disabled: true },
          { key: "documentos", label: "Documentos", disabled: true },
        ]}
      >
        {(active) =>
          active === "personales" ? (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
              <Field label="Nombres" value={empleado.nombre} />
              <Field label="Apellidos" value={empleado.apellido} />
              <Field label="Documento de identidad" value={empleado.documento_identidad ?? "—"} />
              <Field label="Código de empleado" value={`#${empleado.codigo_empleado}`} />
              <Field label="Correo" value={empleado.email ?? "—"} />
              <Field label="Teléfono" value={empleado.telefono ?? "—"} />
            </div>
          ) : (
            <EmptyState
              title="Requiere un modelo de datos nuevo"
              description="Esta pestaña necesita tablas/catálogos y permisos que todavía no existen (ver docs/RRHH_MVP.md §14) — pendiente de una Paso Cero aparte, no forma parte de este rediseño visual."
            />
          )
        }
      </FormTabs>

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
        <EmptyState
          title="Sin permiso para ver el expediente laboral"
          description="No tenés el permiso rrhh.expedientes.contratos.ver."
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="text-sm text-neutral-900">{value}</span>
    </div>
  );
}
