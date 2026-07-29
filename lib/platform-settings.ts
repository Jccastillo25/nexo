import { createClient } from "@/lib/supabase/server";

export type PlatformSettings = {
  productName: string;
  logoUrl: string | null;
  copyrightText: string | null;
};

const DEFAULTS: PlatformSettings = {
  productName: "Ruta360",
  logoUrl: null,
  copyrightText: null,
};

// Lectura pública (RLS lo permite a cualquiera): usada tanto en pantallas
// autenticadas como en las de login, antes de que exista sesión.
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("platform_settings")
    .select("product_name, logo_url, copyright_text")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return DEFAULTS;

  return {
    productName: data.product_name,
    logoUrl: data.logo_url,
    copyrightText: data.copyright_text,
  };
}
