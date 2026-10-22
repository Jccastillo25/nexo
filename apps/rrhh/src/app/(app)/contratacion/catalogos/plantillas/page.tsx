import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
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
  const { supabase, companyId } = await contextoActual<Database>();
  // Plantillas en paralelo con los permisos (la RLS las protege igual).
  const [permisos, plantillasRes] = await Promise.all([
    permisosDe(),
    supabase
      .schema("rrhh")
      .from("plantillas_contrato")
      .select("id, nombre, descripcion, activo, storage_path")
      .eq("company_id", companyId)
      .order("nombre"),
  ]);

  if (!permisos.plantillasVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Plantillas de contrato" />
        <EmptyState variant="no-access" title="No tienes acceso a las plantillas de contrato" />
      </div>
    );
  }

  if (plantillasRes.error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("plantillas: listado", plantillasRes.error);
    throw new Error("No se pudieron cargar las plantillas.");
  }
  const plantillas: PlantillaRow[] = (plantillasRes.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    activo: p.activo,
    tieneArchivo: p.storage_path != null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plantillas de contrato"
        description="Catálogo de plantillas. Se pueden asignar como predeterminadas de un puesto."
      />
      <PlantillasPanel
        plantillas={plantillas}
        canCrear={permisos.plantillasCrear}
        canEditar={permisos.plantillasEditar}
      />
    </div>
  );
}
