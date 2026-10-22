import { redirect } from "next/navigation";

// Regla obligatoria (CLAUDE.md): todo modulo aterriza en su Dashboard de
// KPIs — nunca una lista de contenido ni una pagina en blanco.
//
// Respaldo: en producción la redirección de `redirects()` en next.config.ts
// corre antes, en el borde, y esta página no llega a ejecutarse
// (rendimiento #1, 2026-10-20). Se conserva por si esa regla falta.
export default function Home() {
  redirect("/dashboard");
}
