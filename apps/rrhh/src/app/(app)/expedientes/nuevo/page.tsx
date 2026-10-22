import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
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
 * F1.1 (2026-09-07): esta pagina solo crea el Expediente General.
 * Compensacion/modalidad de contrato pertenecen al flujo de Contrato (F1.2).
 */
export default async function NuevoEmpleadoPage() {
  const permisos = await permisosDe();

  if (!permisos.empleadosCrear) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Nuevo empleado" back={{ href: "/expedientes", label: "Empleados" }} />
        <EmptyState variant="no-access" title="No tienes acceso a dar de alta empleados" />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Nuevo empleado"
        description="Crea el expediente general. El puesto, el salario y el PIN se asignan después, con su contrato."
        back={{ href: "/expedientes", label: "Empleados" }}
      />
      <NuevoEmpleadoForm />
    </div>
  );
}
