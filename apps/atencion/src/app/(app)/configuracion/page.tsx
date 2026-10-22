import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader } from "@nexo/ui";
import { mensajeAtencion } from "@/lib/errores";
import { permisosDe } from "@/lib/permisos";
import type { Database, MiEstado, Pantalla, PuestoEstado } from "@/lib/supabase/database.types";
import SelectorSucursal from "./selector-sucursal";
import PuestosPanel from "./puestos-panel";
import PantallasPanel from "./pantallas-panel";

export const metadata: Metadata = {
  title: "Configuración · Atención",
};

export const dynamic = "force-dynamic";

/** Puestos y pantallas públicas de cada sucursal. */
export default async function ConfiguracionPage({ searchParams }: PageProps<"/configuracion">) {
  const { supabase, companyId } = await contextoActual<Database>();
  // atencion_mi_estado solo exige ver el módulo (ya lo garantiza el layout):
  // va en paralelo con los permisos, que salen de la caché del request.
  const [permisos, params, { data: estadoRaw, error: errorEstado }] = await Promise.all([
    permisosDe(),
    searchParams,
    supabase.rpc("atencion_mi_estado", { p_company_id: companyId }),
  ]);
  const puedePuestos = permisos.puestosGestionar;
  const puedePantallas = permisos.pantallasGestionar;

  if (!puedePuestos && !puedePantallas) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHeader title="Configuración" />
        <EmptyState
          variant="no-access"
          title="No tienes acceso a la configuración"
          description="Tu rol no permite configurar puestos ni pantallas. Si lo necesitas, pide acceso a quien administra Nexo en tu empresa."
        />
      </div>
    );
  }

  const sucursales = (estadoRaw as unknown as MiEstado | null)?.sucursales ?? [];
  const pedida = params.sucursal;
  const sucursalId =
    (typeof pedida === "string" && sucursales.some((s) => s.id === pedida) ? pedida : null) ?? sucursales[0]?.id ?? null;

  let puestos: PuestoEstado[] = [];
  let pantallas: Pantalla[] = [];
  let errorPuestos = false;
  let errorPantallas = false;
  if (sucursalId) {
    const [p, pa] = await Promise.all([
      puedePuestos ? supabase.rpc("atencion_listar_puestos", { p_company_id: companyId, p_sucursal_id: sucursalId }) : null,
      puedePantallas
        ? supabase.rpc("atencion_listar_pantallas", { p_company_id: companyId, p_sucursal_id: sucursalId })
        : null,
    ]);
    if (p?.error) console.error("atencion_listar_puestos (configuración)", p.error);
    if (pa?.error) console.error("atencion_listar_pantallas (configuración)", pa.error);
    errorPuestos = Boolean(p?.error);
    errorPantallas = Boolean(pa?.error);
    puestos = p && !p.error ? (p.data ?? []) : [];
    pantallas = pa && !pa.error ? (pa.data ?? []) : [];
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Puestos de atención y pantallas públicas de cada sucursal. Las sucursales se crean en Nexo → Configuración → Sucursales."
      />
      {errorEstado ? (
        <EmptyState
          variant="error"
          title="No se pudieron cargar tus sucursales"
          description={mensajeAtencion(errorEstado, "atencion_mi_estado (configuración)", "Recarga la página para intentarlo de nuevo.")}
        />
      ) : sucursales.length === 0 || !sucursalId ? (
        <EmptyState
          title="Sin sucursales"
          description="No tienes sucursales asignadas. Crea una en Nexo → Configuración → Sucursales y asígnatela en Usuarios."
        />
      ) : (
        <>
          <SelectorSucursal sucursales={sucursales} actual={sucursalId} />
          {puedePuestos && <PuestosPanel sucursalId={sucursalId} puestos={puestos} errorCarga={errorPuestos} />}
          {puedePantallas && (
            <PantallasPanel sucursalId={sucursalId} pantallas={pantallas} errorCarga={errorPantallas} />
          )}
        </>
      )}
    </div>
  );
}
