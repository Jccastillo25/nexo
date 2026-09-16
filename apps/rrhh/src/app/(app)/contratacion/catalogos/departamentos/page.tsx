import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
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
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canCrear, canEditar] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.departamentos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.departamentos.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.departamentos.editar"),
  ]);

  let departamentos: DepartamentoRow[] = [];
  if (canVer) {
    const { data, error } = await supabase
      .schema("rrhh")
      .from("departamentos")
      .select("id, nombre, descripcion, activo")
      .eq("company_id", companyId)
      .order("nombre");

    if (error) throw new Error(`No se pudieron cargar los departamentos: ${error.message}`);
    departamentos = data ?? [];
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Departamentos"
        description="Unidades organizacionales de la empresa (ej. Ventas, Operaciones) — usadas al crear un puesto o un contrato."
      />

      {canVer ? (
        <DepartamentosPanel departamentos={departamentos} canCrear={canCrear} canEditar={canEditar} />
      ) : (
        <EmptyState
          title="Sin permiso para ver departamentos"
          description="No tenés el permiso rrhh.expedientes.departamentos.ver."
        />
      )}
    </div>
  );
}
