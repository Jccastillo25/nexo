import { createClient } from "@/lib/supabase/client";

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
