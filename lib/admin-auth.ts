import "server-only";
import { createClient } from "@/lib/supabase/server";

// Verifica que el usuario autenticado (via cookies) sea admin de una
// empresa, y devuelve su company_id. Usado por los Route Handlers de
// /api/admin/*, que hacen el resto del trabajo con service_role.
export async function requireAdmin(): Promise<{ id: string; companyId: string } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("admins")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  return { id: user.id, companyId: data.company_id };
}
