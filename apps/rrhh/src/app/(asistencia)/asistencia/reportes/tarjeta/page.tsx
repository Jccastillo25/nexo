import type { Metadata } from "next";
import { VistaReporte } from "../_componentes/vista-reporte";

export const metadata: Metadata = { title: "Tarjeta individual · Asistencia" };

export default async function ReporteTarjetaPage({ searchParams }: PageProps<"/asistencia/reportes/tarjeta">) {
  return <VistaReporte reporte="tarjeta" searchParams={await searchParams} />;
}
