import { redirect } from "next/navigation";

export default function RootPage() {
  // El proxy ya resuelve "/" según sesión y rol (admin -> /admin, driver -> /driver);
  // este es solo el fallback si algo llega aquí sin pasar por el proxy.
  redirect("/login");
}
