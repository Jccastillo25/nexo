import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import DepartamentosPanel, { type DepartamentoRow } from "./departamentos-panel";

export const metadata: Metadata = {
  title: "Departamentos · RRHH",
};

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): Contratación → Catálogos →
 * Departamentos. Departamento ORGANIZACIONAL de la empresa (Ventas,
 * Operaciones) -- no confundir con departamento geográfico de Nicaragua
 * (Fase 5, catálogo aparte para la dirección del empleado).
 */
export default async function DepartamentosPage() {
  const { supabase, companyId } = await contextoActual<Database>();
  // Departamentos en paralelo con los permisos (la RLS los protege igual).
  const [permisos, departamentosRes] = await Promise.all([
    permisosDe(),
    supabase
      .schema("rrhh")
      .from("departamentos")
      .select("id, nombre, descripcion, activo")
      .eq("company_id", companyId)
      .order("nombre"),
  ]);

  if (!permisos.departamentosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Departamentos" />
        <EmptyState variant="no-access" title="No tienes acceso a los departamentos" />
      </div>
    );
  }

  if (departamentosRes.error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("departamentos: listado", departamentosRes.error);
    throw new Error("No se pudieron cargar los departamentos.");
  }
  const departamentos: DepartamentoRow[] = departamentosRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departamentos"
        description="Unidades de la empresa (por ejemplo, Ventas u Operaciones), usadas al crear un puesto o un contrato."
      />
      <DepartamentosPanel
        departamentos={departamentos}
        canCrear={permisos.departamentosCrear}
        canEditar={permisos.departamentosEditar}
      />
    </div>
  );
}
