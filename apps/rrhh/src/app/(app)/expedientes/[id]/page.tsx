import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, FormTabs, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export const metadata: Metadata = {
  title: "Expediente · RRHH",
};

/**
 * Ficha del Expediente General de un empleado — SOLO información de
 * persona. Reconciliación de navegación 2026-09-14 (P2, ver
 * docs/status-log/): decisión vigente del usuario, "Expediente =
 * información de la persona" / "Contratación = relación laboral
 * completa" — esta página ya NO contiene contratos, compensación,
 * jornada, estado/gestión de PIN, activar, finalizar, regenerar PIN ni
 * ninguna otra acción contractual. Todo ese ciclo de vida se movió a
 * /contratacion/contratos (listado) y /contratacion/contratos/[id]
 * (ficha de UN contrato, con el flujo completo) — mismas Server
 * Actions/RPC de siempre, reubicadas en contratacion/contratos/actions.ts,
 * no duplicadas.
 *
 * Antes (hasta 2026-09-08) esta página incluía una sección "Expediente
 * laboral" (ContratosPanel) embebida abajo de las pestañas — se retiró
 * por completo, no se ocultó condicionalmente.
 */
export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, empleadoResult] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.ver"),
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
    </div>
  );
}

function PestanaPendiente() {
  return (
    <EmptyState
      title="Requiere un modelo de datos nuevo"
      description="Esta pestaña necesita tablas/catálogos y permisos que todavía no existen (ver docs/RRHH_MVP.md §14) — pendiente de una Paso Cero aparte."
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
