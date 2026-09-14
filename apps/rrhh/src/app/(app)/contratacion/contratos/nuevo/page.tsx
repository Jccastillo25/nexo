import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import NuevoContratoForm, { type EmpleadoOption } from "./nuevo-contrato-form";

export const metadata: Metadata = {
  title: "Nuevo contrato · RRHH",
};

/**
 * Contratación → Contratos → Nuevo contrato (P2, reconciliación de
 * navegación 2026-09-14, ver docs/status-log/): seleccionar/buscar un
 * empleado EXISTENTE del Expediente General y crear su contrato en
 * borrador — este es ahora el único punto de entrada del ciclo
 * contractual (antes nacía embebido en /expedientes/[id]). No crea
 * empleados — eso sigue siendo /expedientes/nuevo (Expediente General,
 * dominio separado).
 */
export default async function NuevoContratoPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canCrear, canEditarSalario] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.editar"),
  ]);

  if (!canCrear) {
    return (
      <EmptyState
        title="Sin permiso para crear contratos"
        description="No tenés el permiso rrhh.expedientes.contratos.crear para esta empresa."
      />
    );
  }

  const { data: empleados, error } = await supabase
    .schema("rrhh")
    .from("empleados")
    .select("id, codigo_empleado, nombre, apellido, documento_identidad")
    .eq("company_id", companyId)
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`No se pudo cargar el listado de empleados: ${error.message}`);
  }

  // Mismo criterio que /expedientes (empleado-row-menu): un empleado con un
  // contrato activo o en borrador ya tiene un contrato "abierto" — crear
  // otro duplicaría el ciclo contractual. Un empleado con solo contratos
  // finalizados (o ninguno) puede recibir uno nuevo.
  const empleadosConAbierto = new Set<string>();
  if ((empleados ?? []).length > 0) {
    const { data: contratosDeTodos } = await supabase
      .schema("rrhh")
      .from("contratos")
      .select("empleado_id, estado")
      .eq("company_id", companyId)
      .in("empleado_id", (empleados ?? []).map((e) => e.id));
    for (const c of contratosDeTodos ?? []) {
      if (c.estado === "activo" || c.estado === "borrador") empleadosConAbierto.add(c.empleado_id);
    }
  }

  const opciones: EmpleadoOption[] = (empleados ?? []).map((e) => ({
    id: e.id,
    nombreCompleto: `${e.nombre} ${e.apellido}`,
    codigoEmpleado: e.codigo_empleado,
    documentoIdentidad: e.documento_identidad,
    tieneContratoAbierto: empleadosConAbierto.has(e.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo contrato"
        description="Seleccioná un empleado existente y creá su contrato en borrador."
      />

      {opciones.length === 0 ? (
        <EmptyState
          title="No hay empleados todavía"
          description="Creá primero el Expediente General del empleado en Expedientes → Nuevo empleado."
        />
      ) : (
        <NuevoContratoForm empleados={opciones} canEditarSalario={canEditarSalario} />
      )}
    </div>
  );
}
