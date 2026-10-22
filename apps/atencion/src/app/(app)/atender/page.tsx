import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, EmptyState, ErrorState, PageHeader } from "@nexo/ui";
import { mensajeAtencion } from "@/lib/errores";
import { permisosDe } from "@/lib/permisos";
import type { Database, MiEstado } from "@/lib/supabase/database.types";
import Recepcion from "./recepcion";
import Puesto from "./puesto";

export const metadata: Metadata = {
  title: "Atender · Atención",
};

export const dynamic = "force-dynamic";

/** Recepción o puesto, según la atención abierta del usuario. */
export default async function AtenderPage() {
  const { supabase, companyId } = await contextoActual<Database>();
  // Los permisos vienen de la misma consulta (en caché) que hizo el layout.
  const [{ data, error }, permisos] = await Promise.all([
    supabase.rpc("atencion_mi_estado", { p_company_id: companyId }),
    permisosDe(),
  ]);

  if (error) {
    // No es lo mismo que "no tienes una atención abierta": la consulta falló.
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Atender" />
        <ErrorState
          title="No se pudo cargar tu atención"
          description={mensajeAtencion(error, "atencion_mi_estado (atender)", "Intenta de nuevo en unos segundos.")}
          homeHref="/dashboard"
        />
      </div>
    );
  }

  const sesion = (data as unknown as MiEstado | null)?.sesion ?? null;

  if (!sesion) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Atender" />
        <EmptyState
          title="No tienes una atención abierta"
          description="Inicia la atención desde el Inicio del módulo para recibir clientes o atender en un puesto."
          action={<ButtonLink href="/dashboard">Ir al inicio</ButtonLink>}
        />
      </div>
    );
  }

  if (sesion.tipo === "recepcion") {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader
          title="Recepción"
          description={`Entrega turnos en ${sesion.sucursal}. La numeración vuelve a 1 cada día.`}
        />
        <Recepcion
          sucursalId={sesion.sucursal_id}
          puedeEntregar={permisos.turnoCrear}
          puedeAnular={permisos.turnoAnular}
          puedeReactivar={permisos.turnoReactivar}
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title={sesion.puesto ?? "Puesto"} description={`Atendiendo en ${sesion.sucursal}.`} />
      <Puesto
        sucursalId={sesion.sucursal_id}
        puesto={sesion.puesto ?? ""}
        puedeLlamar={permisos.turnoLlamar}
        puedeFueraOrden={permisos.turnoFueraOrden}
        puedeFinalizar={permisos.turnoFinalizar}
        puedeAusente={permisos.turnoAusente}
        puedeReactivar={permisos.turnoReactivar}
      />
    </div>
  );
}
