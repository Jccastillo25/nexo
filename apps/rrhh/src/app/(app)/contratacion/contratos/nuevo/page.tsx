import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import NuevoContratoForm, {
  type EmpleadoOption,
  type PuestoOption,
  type DepartamentoOption,
  type PlantillaOption,
  type PuestoPlantillaOption,
} from "./nuevo-contrato-form";

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
 *
 * 2026-09-17: puesto/departamento/plantilla pasan a ser obligatorios (ver
 * supabase/migrations/20260917100000_...) — esta página ahora también
 * carga `puesto_plantillas` (para filtrar plantillas válidas por puesto) y
 * el `id` del contrato abierto de cada empleado (para poder enlazarlo,
 * no solo avisar que existe).
 */
export default async function NuevoContratoPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canCrear, canEditarSalario, canVerPuestos, canVerDepartamentos, canVerPlantillas] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.puestos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.departamentos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.plantillas.ver"),
  ]);

  if (!canCrear) {
    return (
      <EmptyState
        title="Sin permiso para crear contratos"
        description="No tenés el permiso rrhh.expedientes.contratos.crear para esta empresa."
      />
    );
  }

  const [puestosRes, departamentosRes, plantillasRes] = await Promise.all([
    canVerPuestos
      ? supabase
          .schema("rrhh")
          .from("puestos")
          .select("id, nombre, departamento_id")
          .eq("company_id", companyId)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: null }),
    canVerDepartamentos
      ? supabase
          .schema("rrhh")
          .from("departamentos")
          .select("id, nombre")
          .eq("company_id", companyId)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: null }),
    canVerPlantillas
      ? supabase
          .schema("rrhh")
          .from("plantillas_contrato")
          .select("id, nombre")
          .eq("company_id", companyId)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: null }),
  ]);
  const puestos: PuestoOption[] = (puestosRes.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    departamentoId: p.departamento_id,
  }));
  const departamentos: DepartamentoOption[] = departamentosRes.data ?? [];
  const plantillas: PlantillaOption[] = plantillasRes.data ?? [];

  let puestoPlantillas: PuestoPlantillaOption[] = [];
  if (canVerPlantillas && puestos.length > 0) {
    const { data } = await supabase
      .schema("rrhh")
      .from("puesto_plantillas")
      .select("puesto_id, plantilla_id, predeterminada")
      .eq("company_id", companyId)
      .eq("activo", true)
      .in(
        "puesto_id",
        puestos.map((p) => p.id)
      );
    puestoPlantillas = (data ?? []).map((r) => ({
      puestoId: r.puesto_id,
      plantillaId: r.plantilla_id,
      predeterminada: r.predeterminada,
    }));
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
  // otro duplicaría el ciclo contractual (también se rechaza server-side en
  // rrhh.fn_crear_contrato, esto es solo para poder avisar antes de
  // intentarlo y enlazar directo a ese contrato).
  const abiertoPorEmpleado = new Map<string, string>();
  if ((empleados ?? []).length > 0) {
    const { data: contratosDeTodos } = await supabase
      .schema("rrhh")
      .from("contratos")
      .select("id, empleado_id, estado")
      .eq("company_id", companyId)
      .in("empleado_id", (empleados ?? []).map((e) => e.id));
    for (const c of contratosDeTodos ?? []) {
      if (c.estado === "activo" || c.estado === "borrador") abiertoPorEmpleado.set(c.empleado_id, c.id);
    }
  }

  const opciones: EmpleadoOption[] = (empleados ?? []).map((e) => ({
    id: e.id,
    nombreCompleto: `${e.nombre} ${e.apellido}`,
    codigoEmpleado: e.codigo_empleado,
    documentoIdentidad: e.documento_identidad,
    contratoAbiertoId: abiertoPorEmpleado.get(e.id) ?? null,
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
        <NuevoContratoForm
          empleados={opciones}
          puestos={puestos}
          departamentos={departamentos}
          plantillas={plantillas}
          puestoPlantillas={puestoPlantillas}
          canEditarSalario={canEditarSalario}
        />
      )}
    </div>
  );
}
