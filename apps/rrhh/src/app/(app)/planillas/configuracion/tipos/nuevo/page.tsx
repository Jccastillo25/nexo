import type { Metadata } from "next";
import { PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { RUTA } from "@/lib/planilla/rutas";
import { PaginaSinAcceso } from "../../_compartido/estados";
import { TipoForm } from "../tipo-form";

export const metadata: Metadata = {
  title: "Nuevo tipo de planilla · RRHH",
};

/** A9. Crear un tipo de planilla (conceptos.gestionar). */
export default async function NuevoTipoPage() {
  const permisos = await permisosDe();
  if (!permisos.conceptosGestionar) {
    return (
      <PaginaSinAcceso
        titulo="Nuevo tipo de planilla"
        pantalla="la creación de tipos de planilla"
        permiso="Gestionar conceptos de planilla"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo tipo de planilla"
        description="Por ejemplo, la planilla quincenal ordinaria o la de aguinaldo."
        back={{ href: RUTA.tipos(), label: "Tipos de planilla" }}
      />
      <TipoForm tipo={null} />
    </div>
  );
}
