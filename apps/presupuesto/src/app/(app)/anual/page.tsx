import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, EmptyState, PageHeader, fechaCorta } from "@nexo/ui";
import { contextoDePagina, puedeVerPresupuesto } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import { aniosDisponibles, leerAnio } from "@/lib/metas/periodo";
import type { Presupuesto } from "@/lib/metas/tipos";
import { SelectorPeriodo } from "@/components/metas/selector-periodo";
import { FormularioPresupuesto } from "./formulario";

export const metadata: Metadata = {
  title: "Presupuesto anual · Presupuesto",
};

export const dynamic = "force-dynamic";

export default async function PresupuestoPage({ searchParams }: PageProps<"/anual">) {
  const [{ supabase, companyId, permisos: p }, params] = await Promise.all([contextoDePagina(), searchParams]);
  if (!puedeVerPresupuesto(p)) redirect(p.propio ? "/dashboard" : "/facturas");
  const puedeEditar = p.presupuesto;

  const anio = leerAnio(params);
  const { data, error } = await supabase.rpc("presupuesto_anual", { p_company_id: companyId, p_anio: anio });
  const r = data as Presupuesto | null;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Presupuesto anual"
        description={
          r?.existe && r.actualizado
            ? `Venta esperada de ${anio} y su reparto por mes. Última actualización: ${fechaCorta(r.actualizado)}.`
            : `Venta esperada de ${anio} y su reparto por mes. De aquí sale la meta mensual de la empresa.`
        }
        actions={<SelectorPeriodo anio={anio} anios={aniosDisponibles()} conMes={false} />}
      />

      {error || !r ? (
        <Alert tone="error">{mensajeUsuario(error, "presupuesto_anual", "No se pudo cargar el presupuesto. Intenta de nuevo.")}</Alert>
      ) : !r.existe && !puedeEditar ? (
        <EmptyState
          title={`Todavía no hay presupuesto para ${anio}`}
          description="Lo define el administrador. Pídeselo para que haya meta de la empresa y metas por vendedor."
        />
      ) : (
        <>
          {!puedeEditar ? <Alert>Solo lectura: tu rol puede ver el presupuesto pero no cambiarlo.</Alert> : null}
          {/* La clave reinicia el formulario al cambiar de año o después de guardar. */}
          <FormularioPresupuesto key={`${anio}-${r.actualizado ?? "nuevo"}`} anio={anio} datos={r} puedeEditar={puedeEditar} />
        </>
      )}
    </div>
  );
}
