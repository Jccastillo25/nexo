import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
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
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.contratosCrear) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Nuevo contrato" back={{ href: "/contratacion/contratos", label: "Contratos" }} />
        <EmptyState variant="no-access" title="No tienes acceso a crear contratos" />
      </div>
    );
  }

  const canEditarSalario = permisos.compensacionEditar;
  const canVerPuestos = permisos.puestosVer;
  const canVerDepartamentos = permisos.departamentosVer;
  const canVerPlantillas = permisos.plantillasVer;

  // Rendimiento (2026-10-20): las seis lecturas son independientes y van en
  // paralelo. Contratos y relaciones puesto-plantilla se filtran por empresa
  // (antes, un `.in()` con todos los ids, que esperaba a la consulta previa).
  const [puestosRes, departamentosRes, plantillasRes, relacionesRes, empleadosRes, contratosRes] = await Promise.all([
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
    canVerPlantillas
      ? supabase
          .schema("rrhh")
          .from("puesto_plantillas")
          .select("puesto_id, plantilla_id, predeterminada")
          .eq("company_id", companyId)
          .eq("activo", true)
      : Promise.resolve({ data: null }),
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, codigo_empleado, nombre, apellido, documento_identidad")
      .eq("company_id", companyId)
      .order("nombre", { ascending: true }),
    supabase
      .schema("rrhh")
      .from("contratos")
      .select("id, empleado_id, estado")
      .eq("company_id", companyId)
      .in("estado", ["activo", "borrador"]),
  ]);
  const puestos: PuestoOption[] = (puestosRes.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    departamentoId: p.departamento_id,
  }));
  const departamentos: DepartamentoOption[] = departamentosRes.data ?? [];
  const plantillas: PlantillaOption[] = plantillasRes.data ?? [];
  const puestoPlantillas: PuestoPlantillaOption[] = (relacionesRes.data ?? []).map((r) => ({
    puestoId: r.puesto_id,
    plantillaId: r.plantilla_id,
    predeterminada: r.predeterminada,
  }));

  const { data: empleados, error } = empleadosRes;
  if (error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("nuevo contrato: empleados", error);
    throw new Error("No se pudo cargar el listado de empleados.");
  }

  // Mismo criterio que /expedientes (empleado-row-menu): un empleado con un
  // contrato activo o en borrador ya tiene un contrato "abierto" — crear
  // otro duplicaría el ciclo contractual (también se rechaza server-side en
  // rrhh.fn_crear_contrato, esto es solo para poder avisar antes de
  // intentarlo y enlazar directo a ese contrato).
  const abiertoPorEmpleado = new Map<string, string>();
  for (const c of contratosRes.data ?? []) {
    abiertoPorEmpleado.set(c.empleado_id, c.id);
  }

  const opciones: EmpleadoOption[] = (empleados ?? []).map((e) => ({
    id: e.id,
    nombreCompleto: `${e.nombre} ${e.apellido}`,
    codigoEmpleado: e.codigo_empleado,
    documentoIdentidad: e.documento_identidad,
    contratoAbiertoId: abiertoPorEmpleado.get(e.id) ?? null,
  }));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Nuevo contrato"
        description="Elige un empleado existente y crea su contrato en borrador."
        back={{ href: "/contratacion/contratos", label: "Contratos" }}
      />

      {opciones.length === 0 ? (
        <EmptyState
          title="Todavía no hay empleados"
          description="Crea primero el expediente general del empleado."
          action={
            permisos.empleadosCrear ? (
              <ButtonLink href="/expedientes/nuevo" variant="secondary">
                Nuevo empleado
              </ButtonLink>
            ) : null
          }
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
