import type { Metadata } from "next";
import { VistaReporte } from "../_componentes/vista-reporte";

export const metadata: Metadata = { title: "Tardanzas y salidas tempranas · Asistencia" };

export default async function ReporteTardanzasPage({ searchParams }: PageProps<"/asistencia/reportes/tardanzas">) {
  return <VistaReporte reporte="tardanzas" searchParams={await searchParams} />;
}
