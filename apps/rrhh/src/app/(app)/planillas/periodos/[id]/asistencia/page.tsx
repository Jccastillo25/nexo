import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, EmptyState } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_PLANILLA, estadoVisual } from "@/lib/planilla/estados";
import { esUuid } from "@/lib/planilla/rutas";
import { consultarRpc } from "@/lib/planilla/servidor";
import type { PropuestaAsistencia } from "@/lib/planilla/tipos";
import { ErrorDeCarga, SinAccesoPlanilla } from "../../compartido";
import { detallePlanilla } from "../../datos";
import { EncabezadoPlanilla } from "../encabezado";
import { ImportarAsistencia } from "./importar-asistencia";

export const metadata: Metadata = {
  title: "Importar de Asistencia · Planilla · RRHH",
};

const TITULO = "Importar de Asistencia";

/**
 * Importar horas extra y ausencias desde las marcas del kiosco (B7,
 * movimientos.crear). Además exige ver la planilla (planilla.ver) y, para
 * leer marcas, `rrhh.asistencia.reportes.ver`: sin él no se llama a la RPC.
 * Solo en planillas ordinarias en borrador o calculadas. Ninguna fila viene
 * marcada (ver ImportarAsistencia).
 */
export default async function ImportarAsistenciaPage({ params }: PageProps<"/planillas/periodos/[id]/asistencia">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.novedadesCrear) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a importar novedades" permiso="Crear movimientos" />;
  }
  if (!permisos.planillaVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
  }

  const d = await detallePlanilla(ctx, id);
  if (d === "no-encontrada") notFound();
  if (!d.ok) {
    if (d.motivo === "denegado") return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
    return <ErrorDeCarga titulo={TITULO} que="la planilla" />;
  }
  const p = d.valor.planilla;
  const encabezado = <EncabezadoPlanilla planilla={p} activa="asistencia" permisos={permisos} />;

  if (p.clase !== "ordinaria") {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        <Alert tone="info">La asistencia se importa solo en planillas ordinarias.</Alert>
      </div>
    );
  }
  if (p.estado !== "borrador" && p.estado !== "calculada") {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        <Alert tone="info">
          La planilla está {estadoVisual(ESTADO_PLANILLA, p.estado).label.toLowerCase()}: ya no se importan novedades.
        </Alert>
      </div>
    );
  }
  if (!permisos.asistenciaReportesVer) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        <EmptyState
          variant="no-access"
          title="Para importar desde Asistencia necesitas también el permiso «Ver reportes de asistencia»"
          description="Pídelo a quien administra Nexo. Mientras tanto, puedes registrar las novedades a mano."
        />
      </div>
    );
  }

  const r = await consultarRpc<PropuestaAsistencia[]>(
    ctx,
    "planilla_asistencia_propuesta",
    { p_planilla_id: id },
    "planilla_asistencia_propuesta"
  );
  // Sin error, una RPC `returns table` siempre responde un arreglo (vacío si no hay filas).
  const filas = r.ok && Array.isArray(r.valor) ? r.valor : [];

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      {encabezado}
      <Alert tone="info">
        Las horas extra y las ausencias salen de las marcas del kiosco. Ninguna fila viene marcada: revisa cada una y marca
        solo las que correspondan.
      </Alert>
      {!r.ok ? (
        r.motivo === "negocio" ? (
          <Alert tone="warning">{r.mensaje}</Alert>
        ) : r.motivo === "denegado" ? (
          <EmptyState
            variant="no-access"
            title="Tu rol no permite leer la asistencia"
            description="Pide los permisos «Crear movimientos» y «Ver reportes de asistencia» a quien administra Nexo."
          />
        ) : (
          <EmptyState variant="error" title="No se pudo cargar la propuesta de asistencia" />
        )
      ) : filas.length === 0 ? (
        <EmptyState
          title="No hay horas extra ni ausencias en las marcas de este período."
          description="Solo se proponen días ya cerrados (anteriores a hoy)."
        />
      ) : (
        <ImportarAsistencia planillaId={p.id} filas={filas} />
      )}
    </div>
  );
}
