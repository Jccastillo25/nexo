import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";
import type { Catalogos } from "@/lib/tipos";
import ArbolClasificacion from "./arbol";

export const metadata: Metadata = {
  title: "Clasificación · Productos",
};

export const dynamic = "force-dynamic";

export default async function ClasificacionPage() {
  const { supabase, companyId } = await contextoActual();
  const [catalogos, permisos] = await Promise.all([
    supabase.rpc("productos_catalogos", { p_company_id: companyId }),
    permisosDe(),
  ]);
  const puedeGestionar = permisos.clasificacion;
  // El detalle técnico queda en el log del servidor, nunca en pantalla.
  if (catalogos.error) console.error("productos_catalogos", catalogos.error);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Clasificación"
        description="Clase › Tipo › Categoría. Cada nivel numera desde 01 dentro de su padre; el sistema propone el siguiente número y se puede cambiar al crear. Cuando un producto lo usa, el número queda fijo."
      />
      {catalogos.error ? (
        <Alert tone="error" title="No se pudo cargar la clasificación">
          Intenta recargar la página.
        </Alert>
      ) : (
        <ArbolClasificacion clasificaciones={(catalogos.data as Catalogos).clasificaciones} puedeGestionar={puedeGestionar} />
      )}
    </div>
  );
}
