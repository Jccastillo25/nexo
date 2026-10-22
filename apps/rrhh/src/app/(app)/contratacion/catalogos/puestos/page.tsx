import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import PuestosPanel, { type PuestoRow, type DepartamentoOption, type PlantillaOption } from "./puestos-panel";

export const metadata: Metadata = {
  title: "Puestos · RRHH",
};

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): Contratación → Catálogos →
 * Puestos. departamento_id es el departamento ORGANIZACIONAL
 * (rrhh.departamentos), no geográfico.
 */
export default async function PuestosPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.puestosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Puestos" />
        <EmptyState variant="no-access" title="No tienes acceso a los puestos" />
      </div>
    );
  }

  const canVerDepartamentos = permisos.departamentosVer;
  const canVerPlantillas = permisos.plantillasVer;

  // Rendimiento (2026-10-20): las cuatro lecturas en paralelo. Las
  // plantillas predeterminadas se filtran por empresa (antes, un `.in()` con
  // los ids de los puestos, que esperaba a la primera consulta).
  const [puestosRes, departamentosRes, plantillasRes, defaultsRes] = await Promise.all([
    supabase
      .schema("rrhh")
      .from("puestos")
      .select("id, nombre, descripcion, activo, departamento_id")
      .eq("company_id", companyId)
      .order("nombre"),
    canVerDepartamentos
      ? supabase
          .schema("rrhh")
          .from("departamentos")
          .select("id, nombre")
          .eq("company_id", companyId)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: null, error: null }),
    canVerPlantillas
      ? supabase
          .schema("rrhh")
          .from("plantillas_contrato")
          .select("id, nombre")
          .eq("company_id", companyId)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: null, error: null }),
    canVerPlantillas
      ? supabase
          .schema("rrhh")
          .from("puesto_plantillas")
          .select("puesto_id, plantilla_id")
          .eq("company_id", companyId)
          .eq("predeterminada", true)
          .eq("activo", true)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (puestosRes.error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("puestos: listado", puestosRes.error);
    throw new Error("No se pudieron cargar los puestos.");
  }

  const departamentos: DepartamentoOption[] = departamentosRes.data ?? [];
  const plantillas: PlantillaOption[] = plantillasRes.data ?? [];
  const defaultsPorPuesto: Record<string, string> = Object.fromEntries(
    (defaultsRes.data ?? []).map((d) => [d.puesto_id, d.plantilla_id])
  );

  const puestos: PuestoRow[] = (puestosRes.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    activo: p.activo,
    departamentoId: p.departamento_id,
    plantillaPredeterminadaId: defaultsPorPuesto[p.id] ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Puestos" description="Catálogo de puestos de trabajo, usados al crear un contrato." />
      <PuestosPanel
        puestos={puestos}
        departamentos={departamentos}
        plantillas={plantillas}
        canCrear={permisos.puestosCrear}
        canEditar={permisos.puestosEditar}
        canVerPlantillas={canVerPlantillas}
        canAsignarPlantilla={permisos.plantillasEditar}
      />
    </div>
  );
}
