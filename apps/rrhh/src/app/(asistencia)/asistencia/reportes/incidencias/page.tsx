import type { Metadata } from "next";
import { VistaReporte } from "../_componentes/vista-reporte";

export const metadata: Metadata = { title: "Incidencias · Asistencia" };

export default async function ReporteIncidenciasPage({ searchParams }: PageProps<"/asistencia/reportes/incidencias">) {
  return <VistaReporte reporte="incidencias" searchParams={await searchParams} />;
}
