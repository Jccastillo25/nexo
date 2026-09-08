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
 *
 * Fix (2026-09-08, ver docs/IMPLEMENTATION_STATUS.md):
 *  - `FormTabs` ya no recibe una funcion como `children` (rompía la página
 *    entera en producción, ver packages/ui/FormTabs.tsx) — el contenido de
 *    cada pestaña se resuelve acá mismo, como JSX, antes de pasarlo.
 *  - Consultas independientes (`empleado`, `contratos`, jornadas del
 *    catálogo) se disparan en paralelo en vez de en cascada — menos
 *    round-trips secuenciales a Postgres por navegación.
 *  - El estado de la credencial se lee con una llamada RPC directa (ya
 *    protegida por `canVerCredenciales`, calculado arriba) en vez de pasar
 *    por la Server Action `verEstadoCredencial`, que repetía el mismo
 *    chequeo de permiso con otro round-trip.
 *  - El Expediente Laboral (contratos/jornada/credencial) ya no puede
 *    tumbar toda la página: un error en esa sección queda contenido y se
 *    muestra como error controlado, sin ocultarlo.
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
    empleadoResult,
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
    // Independiente de todos los permisos de arriba (solo necesita id +
    // companyId) — se dispara en paralelo en vez de esperar a que
    // resuelvan los 10 chequeos de permiso primero.
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, codigo_empleado, nombre, apellido, documento_identidad, email, telefono")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (!canVer) {
    return (
      <EmptyState
        title="Sin permiso para ver este expediente"
        description="No tenés el permiso rrhh.expedientes.empleados.ver para esta empresa."
      />
    );
  }

  const { data: empleado, error: empleadoError } = empleadoResult;
  if (empleadoError) {
    throw new Error(`No se pudo cargar el expediente: ${empleadoError.message}`);
  }
  if (!empleado) {
    notFound();
  }

  // Expediente Laboral: seccion aislada — un error aca (contratos,
  // compensacion, credencial o jornada) no debe tumbar el resto de la
  // pagina (Perfil/Datos generales ya se resolvieron arriba). Se captura y
  // se muestra como error controlado, nunca se oculta.
  let contratos: ContratoRow[] = [];
  let credencial: CredencialEstado | null = null;
  let jornadasDisponibles: JornadaOption[] = [];
  const jornadaVigentePorContrato: Record<string, JornadaVigente> = {};
  let expedienteLaboralError: string | null = null;

  if (canVerContratos) {
    try {
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

      const contratoIds = (contratosData ?? []).map((c) => c.id);
      const contratosNoFinalizados = (contratosData ?? [])
        .filter((c) => c.estado !== "finalizado")
        .map((c) => c.id);
      const contratoActivoId = (contratosData ?? []).find((c) => c.estado === "activo")?.id;

      // Estas tres consultas son independientes entre si (solo dependen de
      // los ids de contrato ya resueltos arriba) — se disparan en
      // paralelo en vez de en cascada.
      const [salariosRes, jornadasCatalogoRes, vigentesRes, credencialRes] = await Promise.all([
        canVerSalario && contratoIds.length > 0
          ? supabase
              .schema("rrhh")
              .from("contrato_compensacion")
              .select("contrato_id, salario_base")
              .in("contrato_id", contratoIds)
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
        canVerTurnos && contratosNoFinalizados.length > 0
          ? supabase
              .schema("rrhh")
              .from("contrato_jornadas")
              .select("contrato_id, jornada_id, vigente_desde, jornadas(nombre)")
              .in("contrato_id", contratosNoFinalizados)
              .is("vigente_hasta", null)
          : Promise.resolve({ data: null }),
        // F1.3: estado de la credencial del contrato activo, si hay uno —
        // RPC directa (ya protegida por canVerCredenciales) en vez de la
        // Server Action verEstadoCredencial, que repetia el mismo chequeo
        // de permiso con otro round-trip de red.
        canVerCredenciales && contratoActivoId
          ? supabase.rpc("estado_credencial_contrato", {
              p_contrato_id: contratoActivoId,
              p_company_id: companyId,
            })
          : Promise.resolve({ data: null }),
      ]);

      const salarios = new Map(
        ((salariosRes.data ?? []) as { contrato_id: string; salario_base: number }[]).map((c) => [
          c.contrato_id,
          c.salario_base,
        ])
      );

      contratos = (contratosData ?? []).map((c) => ({
        ...c,
        salario_base: salarios.get(c.id) ?? null,
      }));

      jornadasDisponibles = jornadasCatalogoRes.data ?? [];

      for (const v of (vigentesRes.data ?? []) as unknown as {
        contrato_id: string;
        jornada_id: string;
        vigente_desde: string;
        jornadas: { nombre: string } | null;
      }[]) {
        jornadaVigentePorContrato[v.contrato_id] = {
          jornadaId: v.jornada_id,
          jornadaNombre: v.jornadas?.nombre ?? "(jornada eliminada)",
          vigenteDesde: v.vigente_desde,
        };
      }

      const credencialRow = (credencialRes.data as
        | { tiene_credencial: boolean; activo: boolean; pin_bloqueado: boolean; rotacion_numero: number }[]
        | null)?.[0];
      if (credencialRow) {
        credencial = {
          tieneCredencial: credencialRow.tiene_credencial,
          activo: credencialRow.activo,
          pinBloqueado: credencialRow.pin_bloqueado,
          rotacionNumero: credencialRow.rotacion_numero,
        };
      }
    } catch (err) {
      expedienteLaboralError =
        err instanceof Error ? err.message : "No se pudo cargar el expediente laboral.";
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
          {
            key: "personales",
            label: "Datos personales",
            content: (
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
                <Field label="Nombres" value={empleado.nombre} />
                <Field label="Apellidos" value={empleado.apellido} />
                <Field label="Documento de identidad" value={empleado.documento_identidad ?? "—"} />
                <Field label="Código de empleado" value={`#${empleado.codigo_empleado}`} />
                <Field label="Correo" value={empleado.email ?? "—"} />
                <Field label="Teléfono" value={empleado.telefono ?? "—"} />
              </div>
            ),
          },
          {
            key: "direccion",
            label: "Dirección",
            disabled: true,
            content: <PestanaPendiente />,
          },
          {
            key: "complementaria",
            label: "Información complementaria",
            disabled: true,
            content: <PestanaPendiente />,
          },
          {
            key: "bancarias",
            label: "Cuentas bancarias",
            disabled: true,
            content: <PestanaPendiente />,
          },
          {
            key: "beneficiario",
            label: "Beneficiario",
            disabled: true,
            content: <PestanaPendiente />,
          },
          {
            key: "documentos",
            label: "Documentos",
            disabled: true,
            content: <PestanaPendiente />,
          },
        ]}
      />

      {!canVerContratos ? (
        <EmptyState
          title="Sin permiso para ver el expediente laboral"
          description="No tenés el permiso rrhh.expedientes.contratos.ver."
        />
      ) : expedienteLaboralError ? (
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-sm font-semibold text-red-800">
            No se pudo cargar el expediente laboral
          </h2>
          <p className="text-sm text-red-700">{expedienteLaboralError}</p>
          <p className="text-xs text-red-600">
            El resto de la ficha (perfil, datos generales) sigue disponible arriba.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

function PestanaPendiente() {
  return (
    <EmptyState
      title="Requiere un modelo de datos nuevo"
      description="Esta pestaña necesita tablas/catálogos y permisos que todavía no existen (ver docs/RRHH_MVP.md §14) — pendiente de una Paso Cero aparte, no forma parte de este rediseño visual."
    />
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
