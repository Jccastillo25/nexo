import type { Metadata } from "next";
import { Alert, EmptyState, PageHeader } from "@nexo/ui";
import { contextoActual } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import type { Database } from "@/lib/supabase/database.types";
import { mensajeAdministracion } from "../errores";
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
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  if (!permisos.sucursalesVer) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Sucursales" />
        <EmptyState variant="no-access" title="No tienes acceso a las sucursales" />
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
        <Alert tone="error">
          {mensajeAdministracion(error, "sucursales: admin_listar_sucursales", "No se pudieron cargar las sucursales. Intenta de nuevo.")}
        </Alert>
      ) : (
        <SucursalesPanel sucursales={sucursales ?? []} puedeGestionar={permisos.sucursalesGestionar} />
      )}
    </div>
  );
}
