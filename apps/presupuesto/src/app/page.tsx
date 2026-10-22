import { redirect } from "next/navigation";

// Regla de la suite: la raíz de cada módulo aterriza en su dashboard.
//
// Respaldo: en producción la redirección de `redirects()` en next.config.ts
// corre antes, en el borde, y esta página no llega a ejecutarse
// (rendimiento #1, 2026-10-20). Se conserva por si esa regla falta.
export default function Home() {
  redirect("/dashboard");
}
