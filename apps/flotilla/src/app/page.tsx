import { redirect } from "next/navigation";

// Regla de la suite: la raíz de cada módulo aterriza en su dashboard.
// Respaldo: en producción la redirección de `redirects()` en next.config.ts
// corre antes, en el borde, y esta página no llega a ejecutarse.
export default function Home() {
  redirect("/dashboard");
}
