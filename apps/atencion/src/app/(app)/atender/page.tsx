import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { MiEstado } from "@/lib/supabase/database.types";
import Recepcion from "./recepcion";
import Puesto from "./puesto";

export const metadata: Metadata = {
  title: "Atender · Atención",
};

export const dynamic = "force-dynamic";

/** Recepción o puesto, según la atención abierta del usuario. */
export default async function AtenderPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const { data } = await supabase.rpc("atencion_mi_estado", { p_company_id: companyId });
  const sesion = (data as unknown as MiEstado | null)?.sesion ?? null;

  if (!sesion) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <PageHeader title="Atender" />
        <EmptyState
          title="No tenés una atención abierta"
          description="Iniciá atención desde el inicio del módulo para recibir clientes o atender en un puesto."
        />
        <div>
          <Link href="/dashboard" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (sesion.tipo === "recepcion") {
    const puedeAnular = await hasPermission(ctx, "atencion.recepcion.turno.cancelar");
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <PageHeader title="Recepción" description={`Entregá turnos en ${sesion.sucursal}. La numeración vuelve a 1 cada día.`} />
        <Recepcion puedeAnular={puedeAnular} />
      </div>
    );
  }

  const [fueraOrden, finalizar, ausente] = await Promise.all([
    hasPermission(ctx, "atencion.puesto.turno.llamar_fuera_orden"),
    hasPermission(ctx, "atencion.puesto.turno.finalizar"),
    hasPermission(ctx, "atencion.puesto.turno.marcar_ausente"),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title={sesion.puesto ?? "Puesto"} description={`Atendiendo en ${sesion.sucursal}.`} />
      <Puesto
        puesto={sesion.puesto ?? ""}
        puedeFueraOrden={fueraOrden}
        puedeFinalizar={finalizar}
        puedeAusente={ausente}
      />
    </div>
  );
}
