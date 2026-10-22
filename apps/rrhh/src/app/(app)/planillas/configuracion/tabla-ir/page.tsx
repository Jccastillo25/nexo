import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge, fechaCorta, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua, sumarDias } from "@/lib/fecha-managua";
import { RUTA } from "@/lib/planilla/rutas";
import { porcentajeExacto } from "@/lib/planilla/formato";
import type { IrTramo } from "@/lib/planilla/tipos";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../_compartido/estados";
import { leerFilas } from "../_compartido/lectura";

export const metadata: Metadata = {
  title: "Tabla de IR · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Tabla de IR",
  pantalla: "la tabla de IR",
  permiso: "Ver parámetros de ley",
};

type TramoFila = Pick<
  IrTramo,
  "id" | "vigente_desde" | "vigente_hasta" | "desde" | "hasta" | "impuesto_base" | "porcentaje" | "sobre_exceso"
>;

interface Vigencia {
  desde: string;
  hasta: string | null;
  tramos: TramoFila[];
}

/** Agrupa los tramos por vigencia, de la más reciente a la más antigua, y cada vigencia por `desde`. */
function agruparVigencias(filas: readonly TramoFila[]): Vigencia[] {
  const mapa = new Map<string, Vigencia>();
  for (const t of filas) {
    const v = mapa.get(t.vigente_desde);
    if (v) v.tramos.push(t);
    else mapa.set(t.vigente_desde, { desde: t.vigente_desde, hasta: t.vigente_hasta, tramos: [t] });
  }
  const lista = [...mapa.values()];
  for (const v of lista) v.tramos.sort((a, b) => a.desde - b.desde);
  return lista.sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : 0));
}

function TablaTramos({ vigencia, caption }: { vigencia: Vigencia; caption: string }) {
  return (
    <DataTable
      rows={vigencia.tramos}
      rowKey={(t) => t.id}
      caption={caption}
      density="compact"
      columns={[
        { key: "desde", header: "Desde", numeric: true, render: (t) => moneda(t.desde) },
        { key: "hasta", header: "Hasta", numeric: true, render: (t) => (t.hasta === null ? "En adelante" : moneda(t.hasta)) },
        { key: "base", header: "Impuesto base", numeric: true, render: (t) => moneda(t.impuesto_base) },
        { key: "pct", header: "% sobre el exceso", numeric: true, render: (t) => porcentajeExacto(t.porcentaje) },
        { key: "exceso", header: "Sobre el exceso de", numeric: true, render: (t) => moneda(t.sobre_exceso) },
      ]}
    />
  );
}

/**
 * A7. Tabla progresiva de IR con vigencia (rrhh.ir_tramos, RLS
 * parametros.ver): la vigencia abierta y, plegadas, las anteriores. "Nueva
 * tabla de IR" (parametros.editar) abre el formulario. Certeza y fuente no se
 * muestran: ir_tramos no las guarda, quedan en la auditoría (D16).
 */
export default async function TablaIrPage() {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.parametrosVer) return <PaginaSinAcceso {...ACCESO} />;

  const resultado = await leerFilas<TramoFila>(
    ctx.supabase
      .schema("rrhh")
      .from("ir_tramos")
      .select("id, vigente_desde, vigente_hasta, desde, hasta, impuesto_base, porcentaje, sobre_exceso")
      .eq("company_id", ctx.companyId)
      .order("vigente_desde", { ascending: false })
      .order("desde", { ascending: true }),
    "ir_tramos: listado",
    "No se pudo cargar la tabla de IR. Intenta de nuevo."
  );
  if (!resultado.ok) return <PaginaFallo acceso={ACCESO} fallo={resultado} que="la tabla de IR" />;

  const hoy = hoyManagua();
  const vigencias = agruparVigencias(resultado.valor);
  const abierta = vigencias.find((v) => v.hasta === null) ?? null;
  const anteriores = vigencias.filter((v) => v !== abierta);
  const programada = abierta !== null && abierta.desde > hoy;
  const rigeHoy = programada
    ? (anteriores.find((v) => v.desde <= hoy && (v.hasta === null || v.hasta >= hoy)) ?? null)
    : null;

  const nueva = permisos.parametrosEditar ? (
    <ButtonLink href={RUTA.tablaIrNueva()} icon={<NexoIcon name="plus" />}>
      Nueva tabla de IR
    </ButtonLink>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tabla de IR"
        description="Tramos de renta neta anual (C$) para el IR de rentas del trabajo. Una tabla nueva no cambia las planillas ya aprobadas."
        actions={nueva}
      />

      {abierta === null ? (
        <EmptyState
          title="Todavía no hay tabla de IR"
          description="Sin tabla vigente no se puede calcular el IR de la planilla."
          action={nueva}
        />
      ) : (
        <section aria-labelledby="tabla-ir-vigente" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="tabla-ir-vigente" className="text-base font-semibold text-neutral-900">
              {programada ? "Tabla programada" : "Tabla vigente"} desde el {fechaCorta(abierta.desde)}
            </h2>
            {programada ? <StatusBadge label="Programada" tone="info" /> : null}
          </div>
          {programada ? (
            <Alert tone="info">
              Hasta el {fechaCorta(sumarDias(abierta.desde, -1))} rige
              {rigeHoy ? ` la tabla del ${fechaCorta(rigeHoy.desde)}` : " la tabla anterior"}.
            </Alert>
          ) : null}
          <TablaTramos vigencia={abierta} caption={`Tramos de IR desde el ${fechaCorta(abierta.desde)}`} />
        </section>
      )}

      {anteriores.length > 0 ? (
        <section aria-labelledby="tabla-ir-anteriores" className="flex flex-col gap-3">
          <h2 id="tabla-ir-anteriores" className="text-base font-semibold text-neutral-900">
            Vigencias anteriores
          </h2>
          {anteriores.map((v) => (
            <details key={v.desde} className="rounded-xl border border-neutral-200 bg-white shadow-xs">
              <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Del {fechaCorta(v.desde)} {v.hasta ? `al ${fechaCorta(v.hasta)}` : "en adelante"}
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {v.tramos.length === 1 ? "1 tramo" : `${v.tramos.length} tramos`}
                </span>
              </summary>
              <div className="border-t border-neutral-200 p-3">
                <TablaTramos vigencia={v} caption={`Tramos de IR del ${fechaCorta(v.desde)}`} />
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
