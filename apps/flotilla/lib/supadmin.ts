import "server-only";
import { createClient } from "@/lib/supabase/server";

// Verifica que el usuario autenticado (via cookies de la request) sea
// Super Admin. Se usa en los Route Handlers de /api/supadmin/*, que
// además hacen su trabajo con el cliente service_role.
export async function requirePlatformAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return { userId: user.id };
}
