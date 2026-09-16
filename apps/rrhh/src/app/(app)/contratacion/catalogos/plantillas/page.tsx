import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import PlantillasPanel, { type PlantillaRow } from "./plantillas-panel";

export const metadata: Metadata = {
  title: "Plantillas de contrato · RRHH",
};

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): Contratación → Catálogos →
 * Plantillas. Solo catálogo (nombre/descripcion/activo) -- el archivo real
 * llega en Fase 4 (Storage privado).
 */
export default async function PlantillasPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canCrear, canEditar] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.plantillas.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.plantillas.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.plantillas.editar"),
  ]);

  let plantillas: PlantillaRow[] = [];
  if (canVer) {
    const { data, error } = await supabase
      .schema("rrhh")
      .from("plantillas_contrato")
      .select("id, nombre, descripcion, activo, storage_path")
      .eq("company_id", companyId)
      .order("nombre");

    if (error) throw new Error(`No se pudieron cargar las plantillas: ${error.message}`);
    plantillas = (data ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      activo: p.activo,
      tieneArchivo: p.storage_path != null,
    }));
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Plantillas de contrato"
        description="Catálogo de plantillas — se pueden asignar como predeterminadas de un puesto."
      />

      {canVer ? (
        <PlantillasPanel plantillas={plantillas} canCrear={canCrear} canEditar={canEditar} />
      ) : (
        <EmptyState
          title="Sin permiso para ver plantillas"
          description="No tenés el permiso rrhh.expedientes.plantillas.ver."
        />
      )}
    </div>
  );
}
