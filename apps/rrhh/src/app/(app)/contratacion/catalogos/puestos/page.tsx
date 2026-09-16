import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
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
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canCrear, canEditar, canVerDepartamentos, canVerPlantillas] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.puestos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.puestos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.puestos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.departamentos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.plantillas.ver"),
  ]);

  let puestos: PuestoRow[] = [];
  let departamentos: DepartamentoOption[] = [];
  let plantillas: PlantillaOption[] = [];

  if (canVer) {
    const [puestosRes, departamentosRes, plantillasRes] = await Promise.all([
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
    ]);

    if (puestosRes.error) throw new Error(`No se pudieron cargar los puestos: ${puestosRes.error.message}`);
    departamentos = departamentosRes.data ?? [];
    plantillas = plantillasRes.data ?? [];

    let defaultsPorPuesto: Record<string, string> = {};
    if (canVerPlantillas && (puestosRes.data ?? []).length > 0) {
      const { data: defaults } = await supabase
        .schema("rrhh")
        .from("puesto_plantillas")
        .select("puesto_id, plantilla_id")
        .in(
          "puesto_id",
          (puestosRes.data ?? []).map((p) => p.id)
        )
        .eq("predeterminada", true)
        .eq("activo", true);
      defaultsPorPuesto = Object.fromEntries((defaults ?? []).map((d) => [d.puesto_id, d.plantilla_id]));
    }

    puestos = (puestosRes.data ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      activo: p.activo,
      departamentoId: p.departamento_id,
      plantillaPredeterminadaId: defaultsPorPuesto[p.id] ?? null,
    }));
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Puestos"
        description="Catálogo de puestos de trabajo — usados al crear un contrato."
      />

      {canVer ? (
        <PuestosPanel
          puestos={puestos}
          departamentos={departamentos}
          plantillas={plantillas}
          canCrear={canCrear}
          canEditar={canEditar}
          canVerPlantillas={canVerPlantillas}
        />
      ) : (
        <EmptyState
          title="Sin permiso para ver puestos"
          description="No tenés el permiso rrhh.expedientes.puestos.ver."
        />
      )}
    </div>
  );
}
