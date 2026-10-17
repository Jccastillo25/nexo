import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import type { Catalogos } from "@/lib/tipos";
import ArbolClasificacion from "./arbol";

export const metadata: Metadata = {
  title: "Clasificación · Productos",
};

export const dynamic = "force-dynamic";

export default async function ClasificacionPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const [catalogos, puedeGestionar] = await Promise.all([
    supabase.rpc("productos_catalogos", { p_company_id: companyId }),
    hasPermission({ supabase, companyId }, P.clasificacion),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Clasificación"
        description="Clase › Tipo › Categoría. Cada nivel numera desde 01 dentro de su padre; el sistema propone el siguiente número y se puede cambiar al crear. Cuando un producto lo usa, el número queda fijo."
      />
      {catalogos.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar la clasificación: {catalogos.error.message}
        </p>
      ) : (
        <ArbolClasificacion clasificaciones={(catalogos.data as Catalogos).clasificaciones} puedeGestionar={puedeGestionar} />
      )}
    </div>
  );
}
