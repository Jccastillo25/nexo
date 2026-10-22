import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { RUTA } from "@/lib/planilla/rutas";
import { AVISO_CONTADOR } from "@/lib/planilla/estados";
import { aPorcentaje } from "@/lib/planilla/formato";
import type { IrTramo } from "@/lib/planilla/tipos";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../../_compartido/estados";
import { leerFilas } from "../../_compartido/lectura";
import { TablaIrForm, type TablaProgramada, type TramoInicial } from "./tabla-ir-form";

export const metadata: Metadata = {
  title: "Nueva tabla de IR · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Nueva tabla de IR",
  pantalla: "la carga de una tabla de IR",
  permiso: "Editar parámetros de ley",
};

type TramoGuardado = Pick<IrTramo, "vigente_desde" | "desde" | "hasta" | "impuesto_base" | "porcentaje" | "sobre_exceso">;

/** Tramos agrupados por vigencia (`vigente_desde`), de la más antigua a la más reciente; cada vigencia por `desde`. */
function agruparVigencias(filas: readonly TramoGuardado[]): { desde: string; tramos: TramoGuardado[] }[] {
  const mapa = new Map<string, TramoGuardado[]>();
  for (const t of filas) {
    const lista = mapa.get(t.vigente_desde);
    if (lista) lista.push(t);
    else mapa.set(t.vigente_desde, [t]);
  }
  return [...mapa.entries()]
    .map(([desde, tramos]) => ({ desde, tramos: [...tramos].sort((a, b) => a.desde - b.desde) }))
    .sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
}

/**
 * A7. Nueva vigencia de la tabla de IR (parametros.editar). Carga todas las
 * vigencias: la nueva fecha debe ser posterior a la tabla que rige HOY, y las
 * tablas programadas que empiezan en esa fecha o después se reemplazan
 * (planilla_ir_tabla_nueva las borra y las deja en la auditoría, salvo que
 * una planilla ya las haya usado: entonces la RPC lo rechaza). Precarga los
 * tramos de la última tabla cargada para editarlos.
 */
export default async function NuevaTablaIrPage() {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.parametrosEditar) return <PaginaSinAcceso {...ACCESO} />;

  const volver = { href: RUTA.tablaIr(), label: "Tabla de IR" };
  const resultado = await leerFilas<TramoGuardado>(
    ctx.supabase
      .schema("rrhh")
      .from("ir_tramos")
      .select("vigente_desde, desde, hasta, impuesto_base, porcentaje, sobre_exceso")
      .eq("company_id", ctx.companyId)
      .order("vigente_desde", { ascending: true })
      .order("desde", { ascending: true }),
    "ir_tramos: vigencias",
    "No se pudo cargar la tabla de IR. Intenta de nuevo."
  );
  if (!resultado.ok) {
    return <PaginaFallo acceso={ACCESO} fallo={resultado} que="la tabla de IR" back={volver} />;
  }

  const hoy = hoyManagua();
  const vigencias = agruparVigencias(resultado.valor);
  // La que rige hoy: la última que empezó hoy o antes. La RPC exige que la nueva empiece después de ella.
  const vigenteHoy = vigencias.filter((v) => v.desde <= hoy).at(-1)?.desde ?? null;
  const programadas: TablaProgramada[] = vigencias
    .filter((v) => v.desde > hoy)
    .map((v) => ({ desde: v.desde, tramos: v.tramos.length }));
  const ultima = vigencias.at(-1) ?? null;
  const iniciales: TramoInicial[] = (ultima?.tramos ?? []).map((t) => ({
    desde: t.desde,
    hasta: t.hasta,
    impuesto_base: t.impuesto_base,
    porcentaje: aPorcentaje(t.porcentaje),
    sobre_exceso: t.sobre_exceso,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva tabla de IR"
        description="Carga los tramos que rigen desde una fecha. Se precargan con la última tabla cargada para que solo cambies lo necesario."
        back={volver}
      />
      <Alert tone="info">
        La tabla que rige antes de la nueva fecha se cierra el día anterior. Si ya hay una tabla programada desde esa fecha o
        después, la nueva la reemplaza. Las planillas ya aprobadas conservan la tabla con que se calcularon. Si el valor sale
        de una fuente que no es oficial, márcalo «Por verificar»: {AVISO_CONTADOR}
      </Alert>
      <TablaIrForm
        tramosIniciales={iniciales}
        precargadaDesde={ultima?.desde ?? null}
        vigenteHoy={vigenteHoy}
        programadas={programadas}
      />
    </div>
  );
}
