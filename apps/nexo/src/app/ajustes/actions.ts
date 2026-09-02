"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyId } from "@/lib/company";

export type SettingsFormState = { error: string | null; success: boolean };

const BUCKET = "platform-assets";

async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  file: File,
  baseName: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${baseName}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) {
    throw new Error(`No se pudo subir "${baseName}": ${error.message}`);
  }
  // Cache-bust: el path es siempre el mismo (upsert), así que sin esto el
  // navegador/CDN podría seguir sirviendo la imagen vieja después de
  // reemplazarla.
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function updateSettings(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();

  try {
    await requirePermission(
      { supabase, companyId: getCompanyId() },
      "nexo.configuracion.editar"
    );
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { error: "No tenés permiso para editar esta configuración.", success: false };
    }
    return { error: "No se pudo verificar el permiso.", success: false };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    // supabase-js tira sincrono ("supabaseKey is required") si falta
    // SUPABASE_SERVICE_ROLE_KEY en el entorno — sin este try/catch, esto
    // reventaba la pagina entera (error 500 generico de Next.js) en vez de
    // mostrar un error legible en el formulario.
    return {
      error: `No se pudo inicializar el cliente de Storage: ${(err as Error).message}. Revisá que SUPABASE_SERVICE_ROLE_KEY esté configurada en el entorno de este deploy.`,
      success: false,
    };
  }

  let logoUrl: string | null = null; // null = no tocar
  const logoFile = formData.get("logo");
  const logoRemove = formData.get("logo_remove") === "on";
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logoUrl = await uploadImage(admin, logoFile, "logo");
    } catch (err) {
      return { error: (err as Error).message, success: false };
    }
  } else if (logoRemove) {
    logoUrl = ""; // '' = limpiar (convencion de la RPC)
  }

  let backgroundUrl: string | null = null;
  const bgFile = formData.get("background");
  const bgRemove = formData.get("background_remove") === "on";
  if (bgFile instanceof File && bgFile.size > 0) {
    try {
      backgroundUrl = await uploadImage(admin, bgFile, "login-background");
    } catch (err) {
      return { error: (err as Error).message, success: false };
    }
  } else if (bgRemove) {
    backgroundUrl = "";
  }

  let bullets: ReturnType<JSON["parse"]> | null = null;
  const bulletsRaw = formData.get("bullets_json");
  if (typeof bulletsRaw === "string" && bulletsRaw.trim()) {
    try {
      bullets = JSON.parse(bulletsRaw);
    } catch {
      return { error: "Los bullets no son un JSON válido.", success: false };
    }
  }

  const { error } = await supabase.rpc("update_platform_settings", {
    p_logo_url: logoUrl,
    p_login_background_url: backgroundUrl,
    p_eyebrow_text: String(formData.get("eyebrow_text") ?? "").trim() || null,
    p_heading_text: String(formData.get("heading_text") ?? "").trim() || null,
    p_tagline: String(formData.get("tagline") ?? "").trim() || null,
    p_bullets: bullets,
    p_copyright_text:
      String(formData.get("copyright_text") ?? "").trim() || null,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/ajustes");
  revalidatePath("/login");
  revalidatePath("/");

  return { error: null, success: true };
}
