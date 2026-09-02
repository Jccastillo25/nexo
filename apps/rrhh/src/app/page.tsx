import { redirect } from "next/navigation";

// Regla obligatoria (CLAUDE.md): todo modulo aterriza en su Dashboard de
// KPIs — nunca una lista de contenido ni una pagina en blanco.
export default function Home() {
  redirect("/dashboard");
}
