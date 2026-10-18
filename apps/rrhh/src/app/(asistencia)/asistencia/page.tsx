import { redirect } from "next/navigation";

/** La raíz de Asistencia aterriza siempre en su Dashboard de KPIs (regla de CLAUDE.md). */
export default function AsistenciaPage() {
  redirect("/asistencia/dashboard");
}
