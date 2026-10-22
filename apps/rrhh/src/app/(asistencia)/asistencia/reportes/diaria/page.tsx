import type { Metadata } from "next";
import { VistaReporte } from "../_componentes/vista-reporte";

export const metadata: Metadata = { title: "Asistencia diaria · Asistencia" };

export default async function ReporteDiariaPage({ searchParams }: PageProps<"/asistencia/reportes/diaria">) {
  return <VistaReporte reporte="diaria" searchParams={await searchParams} />;
}
