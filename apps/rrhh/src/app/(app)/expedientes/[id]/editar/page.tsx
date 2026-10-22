import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import EditarEmpleadoForm from "./editar-empleado-form";

export const metadata: Metadata = {
  title: "Editar expediente · RRHH",
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * P3 (reconciliación de navegación 2026-09-14, ver docs/status-log/):
 * edición real del Expediente General — ruta separada de la ficha de
 * solo lectura (/expedientes/[id]). Solo permite editar los campos del
 * Expediente General (nombre/apellido/documento/email/teléfono) — nunca
 * datos contractuales.
 */
export default async function EditarExpedientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ES_UUID.test(id)) notFound();

  const { supabase, companyId } = await contextoActual<Database>();
  const [permisos, empleadoResult] = await Promise.all([
    permisosDe(),
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, nombre, apellido, documento_identidad, email, telefono")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (!permisos.empleadosEditar) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Editar expediente" back={{ href: `/expedientes/${id}`, label: "Expediente" }} />
        <EmptyState variant="no-access" title="No tienes acceso a editar este expediente" />
      </div>
    );
  }

  const { data: empleado, error } = empleadoResult;
  if (error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("editar expediente: empleado", error);
    throw new Error("No se pudo cargar el expediente.");
  }
  if (!empleado) {
    notFound();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Editar: ${empleado.nombre} ${empleado.apellido}`}
        description="Datos personales del expediente general."
        back={{ href: `/expedientes/${id}`, label: "Expediente" }}
      />
      <EditarEmpleadoForm empleado={empleado} />
    </div>
  );
}
