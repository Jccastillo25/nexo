import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";
import Importador from "./importador";

export const metadata: Metadata = {
  title: "Importar y exportar · Productos",
};

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const permisos = await permisosDe();
  if (!permisos.importar && !permisos.exportar) redirect("/catalogo");
  const puedeImportar = permisos.importar && permisos.costoEditar && permisos.fiscal;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Importar y exportar"
        description="Carga el catálogo desde los Excel del ERP y descarga el catálogo de Nexo en el formato del ERP."
      />
      <Importador puedeImportar={puedeImportar} puedeExportar={permisos.exportar} />
    </div>
  );
}
