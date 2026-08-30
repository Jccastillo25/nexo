import { redirect } from "next/navigation";

/**
 * Ya no hay formulario de login propio (login unico / SSO — ver
 * lib/supabase/middleware.ts). Si alguien llega aca es porque YA tiene
 * sesion (si no, el middleware lo hubiera rebotado antes de llegar a esta
 * pagina) y probablemente entro por un link viejo — lo mandamos derecho a
 * clientes.
 */
export default function LoginPage() {
  redirect("/clientes");
}
