import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import NuevoEmpleadoForm from "./nuevo-empleado-form";

export const metadata: Metadata = {
  title: "Nuevo empleado · RRHH",
};

/**
 * Guard de recurso: rrhh.expedientes.empleados.crear. La capa que de
 * verdad protege es el chequeo DENTRO de rrhh.fn_crear_empleado (ver
 * 20260907152301_f1_1_separar_expediente_general_laboral.sql) — este
 * chequeo aca es UX (norma v3.0): sin el, alguien sin permiso veria el
 * formulario completo y recien se enteraria del rechazo al enviar.
 *
 * F1.1 (2026-09-07): ya no pasa `canEditarCompensacion` al formulario —
 * esta pagina solo crea el Expediente General. Compensacion/modalidad de
 * contrato pasan a formar parte del flujo de Contrato (F1.2).
 */
export default async function NuevoEmpleadoPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canCrear = await hasPermission(
    { supabase, companyId },
    "rrhh.expedientes.empleados.crear"
  );

  if (!canCrear) {
    return (
      <EmptyState
        title="Sin permiso para dar de alta empleados"
        description="No tenés el permiso rrhh.expedientes.empleados.crear para esta empresa."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Nuevo empleado" breadcrumb={[{ label: "Expedientes", href: "/expedientes" }]} />
      <NuevoEmpleadoForm />
    </div>
  );
}
