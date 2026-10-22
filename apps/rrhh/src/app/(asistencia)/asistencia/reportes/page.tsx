import { redirect } from "next/navigation";

/** /asistencia/reportes no tiene pantalla propia: abre la asistencia diaria. */
export default function ReportesPage() {
  redirect("/asistencia/reportes/diaria");
}
