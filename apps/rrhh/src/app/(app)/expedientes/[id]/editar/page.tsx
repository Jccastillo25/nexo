import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import EditarEmpleadoForm from "./editar-empleado-form";

export const metadata: Metadata = {
  title: "Editar expediente · RRHH",
};

/**
 * P3 (reconciliación de navegación 2026-09-14, ver docs/status-log/):
 * edición real del Expediente General — ruta separada de la ficha de
 * solo lectura (/expedientes/[id]), que antes "Editar" reutilizaba sin
 * ninguna funcionalidad real. Solo permite editar los campos del
 * Expediente General (nombre/apellido/documento/email/teléfono) — nunca
 * datos contractuales.
 */
export default async function EditarExpedientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canEditar, empleadoResult] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.editar"),
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, nombre, apellido, documento_identidad, email, telefono")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (!canEditar) {
    return (
      <EmptyState
        title="Sin permiso para editar este expediente"
        description="No tenés el permiso rrhh.expedientes.empleados.editar para esta empresa."
      />
    );
  }

  const { data: empleado, error } = empleadoResult;
  if (error) {
    throw new Error(`No se pudo cargar el expediente: ${error.message}`);
  }
  if (!empleado) {
    notFound();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={`Editar — ${empleado.nombre} ${empleado.apellido}`} />
      <EditarEmpleadoForm empleado={empleado} />
    </div>
  );
}
