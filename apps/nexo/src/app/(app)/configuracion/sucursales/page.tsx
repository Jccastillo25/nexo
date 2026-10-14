import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import SucursalesPanel from "./sucursales-panel";

export const metadata: Metadata = {
  title: "Sucursales · Nexo",
};

/**
 * Sucursales de la empresa (core.sucursales, 2026-10-14), compartidas por
 * todos los módulos. Cada usuario se asigna a las suyas en Configuración →
 * Usuarios; Atención las usa para la fila, los puestos y la numeración diaria.
 */
export default async function SucursalesPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const [canView, canManage] = await Promise.all([
    hasPermission(ctx, "nexo.administracion.sucursales.ver"),
    hasPermission(ctx, "nexo.administracion.sucursales.gestionar"),
  ]);

  if (!canView) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Sucursales" />
        <EmptyState
          title="Sin permiso para ver sucursales"
          description="Tu cuenta no tiene el permiso nexo.administracion.sucursales.ver para esta empresa."
        />
      </div>
    );
  }

  const { data: sucursales, error } = await supabase.rpc("admin_listar_sucursales", { p_company_id: companyId });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Sucursales"
        description="Lugares donde opera la empresa. Cada usuario trabaja en las sucursales que le asignes en Usuarios."
      />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar las sucursales: {error.message}
        </p>
      ) : (
        <SucursalesPanel sucursales={sucursales ?? []} puedeGestionar={canManage} />
      )}
    </div>
  );
}
