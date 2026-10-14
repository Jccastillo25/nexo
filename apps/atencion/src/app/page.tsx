import { redirect } from "next/navigation";

// Regla de la suite: la raíz de cada módulo aterriza en su dashboard.
export default function Home() {
  redirect("/dashboard");
}
