import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Bucket privado "evidence": ruta {company_id}/{trip_id}/{filename}.
// Se guarda y retorna el path del objeto (no una URL pública), consistente
// con que el bucket no es público.
export async function uploadEvidencePhoto(file: File, path: string): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("evidence").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

// El bucket "evidence" es privado: para mostrar una foto (ej. al admin
// revisando una novedad) hace falta una URL firmada, no la URL pública.
// Recibe el cliente de quien llama (server o browser) para respetar su RLS.
export async function getEvidencePhotoSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data } = await supabase.storage.from("evidence").createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

// Bucket público "company-logos": ruta {company_id}/logo.{ext}.
// upsert:true porque solo existe un logo vigente por empresa.
// Retorna la URL pública lista para usar en <img>.
export async function uploadCompanyLogo(file: File, companyId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const path = `${companyId}/logo.${ext}`;

  const { error } = await supabase.storage.from("company-logos").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
  // Cache-bust: el path es siempre el mismo (upsert), sin esto el navegador
  // seguiria mostrando la imagen vieja cacheada bajo la misma URL.
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Bucket público "platform-assets": logo único de la plataforma (Ruta360),
// distinto del logo de cada empresa. Mismo patrón de upsert + cache-bust.
export async function uploadPlatformLogo(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const path = `logo.${ext}`;

  const { error } = await supabase.storage.from("platform-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("platform-assets").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
