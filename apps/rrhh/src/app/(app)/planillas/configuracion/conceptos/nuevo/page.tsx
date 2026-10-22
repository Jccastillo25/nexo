import type { Metadata } from "next";
import { PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { RUTA } from "@/lib/planilla/rutas";
import { PaginaSinAcceso } from "../../_compartido/estados";
import { ConceptoForm } from "../concepto-form";

export const metadata: Metadata = {
  title: "Nuevo concepto · RRHH",
};

/** A8. Crear un concepto propio (conceptos.gestionar). */
export default async function NuevoConceptoPage() {
  const permisos = await permisosDe();
  if (!permisos.conceptosGestionar) {
    return (
      <PaginaSinAcceso
        titulo="Nuevo concepto"
        pantalla="la creación de conceptos"
        permiso="Gestionar conceptos de planilla"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo concepto"
        description="Un ingreso o una deducción de monto fijo propio de la empresa (bonos, comisiones, descuentos)."
        back={{ href: RUTA.conceptos(), label: "Conceptos" }}
      />
      <ConceptoForm concepto={null} />
    </div>
  );
}
