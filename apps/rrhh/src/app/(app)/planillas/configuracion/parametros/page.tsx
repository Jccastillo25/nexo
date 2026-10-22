import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, PageHeader, StatusBadge, fechaCorta } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { RUTA } from "@/lib/planilla/rutas";
import { AVISO_CONTADOR, ESTADO_CERTEZA, estadoVisual } from "@/lib/planilla/estados";
import { PARAMETROS, etiquetaParametro } from "@/lib/planilla/etiquetas";
import { valorParametro } from "@/lib/planilla/formato";
import type { ParametroLey } from "@/lib/planilla/tipos";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../_compartido/estados";
import { leerFilas, primero } from "../_compartido/lectura";
import { ParametrosPanel, type ParametroVista, type VigenciaParametro } from "./parametros-panel";

export const metadata: Metadata = {
  title: "Parámetros de ley · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Parámetros de ley",
  pantalla: "los parámetros de ley",
  permiso: "Ver parámetros de ley",
};

type FilaParametro = Pick<
  ParametroLey,
  "id" | "codigo" | "unidad" | "valor" | "vigente_desde" | "vigente_hasta" | "certeza" | "fuente"
>;

const ORDEN = Object.keys(PARAMETROS);

function posicion(codigo: string): number {
  const i = ORDEN.indexOf(codigo);
  return i === -1 ? ORDEN.length : i;
}

function vigencia(f: FilaParametro): VigenciaParametro {
  return {
    id: f.id,
    valor: f.valor,
    vigente_desde: f.vigente_desde,
    vigente_hasta: f.vigente_hasta,
    certeza: f.certeza,
    fuente: f.fuente,
  };
}

/**
 * A6. Parámetros de ley con vigencia (rrhh.parametros_ley, RLS
 * parametros.ver). La tabla muestra la vigencia abierta de cada código; si
 * esa empieza después de hoy, también el valor que rige hoy. `?historial=1`
 * agrega las vigencias cerradas. "Nueva vigencia" (parametros.editar) llama a
 * planilla_parametro_vigencia_nueva.
 */
export default async function ParametrosPage({ searchParams }: PageProps<"/planillas/configuracion/parametros">) {
  const [ctx, permisos, params] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.parametrosVer) return <PaginaSinAcceso {...ACCESO} />;

  const resultado = await leerFilas<FilaParametro>(
    ctx.supabase
      .schema("rrhh")
      .from("parametros_ley")
      .select("id, codigo, unidad, valor, vigente_desde, vigente_hasta, certeza, fuente")
      .eq("company_id", ctx.companyId)
      .order("codigo")
      .order("vigente_desde", { ascending: false }),
    "parametros_ley: listado",
    "No se pudieron cargar los parámetros de ley. Intenta de nuevo."
  );
  if (!resultado.ok) return <PaginaFallo acceso={ACCESO} fallo={resultado} que="los parámetros de ley" />;

  const hoy = hoyManagua();
  const historial = primero(params.historial) === "1";

  const porCodigo = new Map<string, FilaParametro[]>();
  for (const f of resultado.valor) {
    const lista = porCodigo.get(f.codigo);
    if (lista) lista.push(f);
    else porCodigo.set(f.codigo, [f]);
  }

  const vistas: ParametroVista[] = [];
  const cerradas: { codigo: string; etiqueta: string; unidad: FilaParametro["unidad"]; filas: FilaParametro[] }[] = [];
  for (const [codigo, filas] of porCodigo) {
    const abierta = filas.find((f) => f.vigente_hasta === null);
    if (abierta) {
      const deHoy =
        abierta.vigente_desde > hoy
          ? (filas.find((f) => f.vigente_desde <= hoy && (f.vigente_hasta === null || f.vigente_hasta >= hoy)) ?? null)
          : null;
      vistas.push({
        codigo,
        etiqueta: etiquetaParametro(codigo),
        unidad: abierta.unidad,
        abierta: vigencia(abierta),
        rigeHoy: deHoy ? vigencia(deHoy) : null,
      });
    }
    const viejas = filas.filter((f) => f.vigente_hasta !== null);
    if (viejas.length > 0) {
      cerradas.push({ codigo, etiqueta: etiquetaParametro(codigo), unidad: viejas[0].unidad, filas: viejas });
    }
  }
  const ordenar = (a: { codigo: string }, b: { codigo: string }) =>
    posicion(a.codigo) - posicion(b.codigo) || a.codigo.localeCompare(b.codigo);
  vistas.sort(ordenar);
  cerradas.sort(ordenar);

  const porVerificar = vistas.filter((v) => v.abierta.certeza === "verificar").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Parámetros de ley"
        description="Tasas, montos y convenciones que usa el cálculo de planilla, cada uno con su vigencia. Un valor nuevo no cambia las planillas ya aprobadas."
        actions={
          <ButtonLink href={RUTA.parametros({ historial: !historial })} variant="secondary">
            {historial ? "Ocultar historial" : "Ver historial"}
          </ButtonLink>
        }
      />

      {porVerificar > 0 ? (
        <Alert
          tone="info"
          title={porVerificar === 1 ? "Hay 1 valor por verificar." : `Hay ${porVerificar} valores por verificar.`}
        >
          {AVISO_CONTADOR} Sirven para simular y calcular, y la planilla los lista en sus avisos.
        </Alert>
      ) : null}

      <ParametrosPanel parametros={vistas} hoy={hoy} puedeEditar={permisos.parametrosEditar} />

      {historial ? (
        <section aria-labelledby="historial-parametros" className="flex flex-col gap-3">
          <h2 id="historial-parametros" className="text-base font-semibold text-neutral-900">
            Vigencias anteriores
          </h2>
          {cerradas.length === 0 ? (
            <p className="text-sm text-neutral-500">Ningún parámetro tiene vigencias anteriores.</p>
          ) : (
            cerradas.map((g) => (
              <details key={g.codigo} className="group rounded-xl border border-neutral-200 bg-white shadow-xs">
                <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  {g.etiqueta}
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    {g.filas.length === 1 ? "1 vigencia anterior" : `${g.filas.length} vigencias anteriores`}
                  </span>
                </summary>
                <div className="border-t border-neutral-200 p-3">
                  <DataTable
                    rows={g.filas}
                    rowKey={(f) => f.id}
                    density="compact"
                    caption={`Vigencias anteriores de ${g.etiqueta}`}
                    columns={[
                      {
                        key: "valor",
                        header: "Valor",
                        numeric: true,
                        render: (f) => valorParametro(f.valor, f.unidad, f.codigo),
                      },
                      {
                        key: "desde",
                        header: "Desde",
                        render: (f) => <span className="tabular-nums">{fechaCorta(f.vigente_desde)}</span>,
                      },
                      {
                        key: "hasta",
                        header: "Hasta",
                        render: (f) => <span className="tabular-nums">{fechaCorta(f.vigente_hasta)}</span>,
                      },
                      {
                        key: "certeza",
                        header: "Certeza",
                        render: (f) => {
                          const c = estadoVisual(ESTADO_CERTEZA, f.certeza);
                          return <StatusBadge label={c.label} tone={c.tone} />;
                        },
                      },
                      { key: "fuente", header: "Fuente", render: (f) => <span className="break-words">{f.fuente ?? "—"}</span> },
                    ]}
                  />
                </div>
              </details>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}
