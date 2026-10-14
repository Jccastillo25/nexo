import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { MiEstado, Pantalla, PuestoEstado } from "@/lib/supabase/database.types";
import SelectorSucursal from "./selector-sucursal";
import PuestosPanel from "./puestos-panel";
import PantallasPanel from "./pantallas-panel";

export const metadata: Metadata = {
  title: "Configuración · Atención",
};

export const dynamic = "force-dynamic";

/** Puestos y pantallas públicas de cada sucursal. */
export default async function ConfiguracionPage({ searchParams }: PageProps<"/configuracion">) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const [puedePuestos, puedePantallas, { data: estadoRaw }] = await Promise.all([
    hasPermission(ctx, "atencion.configuracion.puesto.gestionar"),
    hasPermission(ctx, "atencion.configuracion.pantalla.gestionar"),
    supabase.rpc("atencion_mi_estado", { p_company_id: companyId }),
  ]);

  if (!puedePuestos && !puedePantallas) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Configuración" />
        <EmptyState title="Sin permiso" description="Tu rol no permite configurar puestos ni pantallas." />
      </div>
    );
  }

  const sucursales = (estadoRaw as unknown as MiEstado | null)?.sucursales ?? [];
  const pedida = (await searchParams).sucursal;
  const sucursalId =
    (typeof pedida === "string" && sucursales.some((s) => s.id === pedida) ? pedida : null) ?? sucursales[0]?.id ?? null;

  let puestos: PuestoEstado[] = [];
  let pantallas: Pantalla[] = [];
  if (sucursalId) {
    const [p, pa] = await Promise.all([
      supabase.rpc("atencion_listar_puestos", { p_company_id: companyId, p_sucursal_id: sucursalId }),
      puedePantallas
        ? supabase.rpc("atencion_listar_pantallas", { p_company_id: companyId, p_sucursal_id: sucursalId })
        : Promise.resolve({ data: [] as Pantalla[] }),
    ]);
    puestos = p.data ?? [];
    pantallas = pa.data ?? [];
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Puestos de atención y pantallas públicas de cada sucursal. Las sucursales se crean en Nexo → Configuración → Sucursales."
      />
      {sucursales.length === 0 || !sucursalId ? (
        <EmptyState
          title="Sin sucursales"
          description="No tenés sucursales asignadas. Creá una en Nexo → Configuración → Sucursales y asignátela en Usuarios."
        />
      ) : (
        <>
          <SelectorSucursal sucursales={sucursales} actual={sucursalId} />
          {puedePuestos && <PuestosPanel sucursalId={sucursalId} puestos={puestos} />}
          {puedePantallas && <PantallasPanel sucursalId={sucursalId} pantallas={pantallas} />}
        </>
      )}
    </div>
  );
}
