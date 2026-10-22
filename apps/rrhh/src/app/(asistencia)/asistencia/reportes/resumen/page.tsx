import type { Metadata } from "next";
import { VistaReporte } from "../_componentes/vista-reporte";

export const metadata: Metadata = { title: "Resumen por persona · Asistencia" };

export default async function ReporteResumenPage({ searchParams }: PageProps<"/asistencia/reportes/resumen">) {
  return <VistaReporte reporte="resumen" searchParams={await searchParams} />;
}
