"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyId } from "@/lib/company";

export type SettingsFormState = { error: string | null; success: boolean };

const BUCKET = "platform-assets";
// Debe coincidir con el limite validado en el cliente (marca-form.tsx).
// 1.25 MB por archivo porque el formulario puede mandar los 3 (logo +
// fondo + favicon) en un mismo submit/Server Action — 3 × 1.25 MB deja
// margen bajo el limite de payload de 4.5 MB de Vercel Functions, que es
// fijo a nivel de infraestructura y no se puede levantar desde
// next.config/vercel.json (ver next.config.ts). La validacion del cliente
// es UX; esta es la que de verdad protege (un cliente puede saltarse el
// input y mandar cualquier FormData).
const MAX_IMAGE_BYTES = 1.25 * 1024 * 1024; // 1.25 MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function validateImageFile(file: File, label: string): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `${label}: formato no permitido (${file.type || "desconocido"}). Usá PNG, JPG, WEBP, GIF o ICO.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${label}: la imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB, el máximo permitido es 1.25 MB.`;
  }
  return null;
}

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
  // P0 (2026-09-14): todo el cuerpo queda envuelto en try/catch — un fallo
  // ya controlado (permiso, validacion, RPC) siempre devuelve un
  // SettingsFormState; cualquier excepcion inesperada (red, Storage, etc.)
  // tambien se convierte en un state legible en vez de propagarse como una
  // Server Action rechazada, que en el cliente (marca-form.tsx) tumbaba la
  // pantalla completa contra el error boundary global. Ver next.config.ts
  // para el limite de body subido de 1 MB (default) a 4 MB (causa raiz
  // real; el techo duro real de 4.5 MB lo impone Vercel Functions, no
  // Next.js — ver el comentario ahí).
  try {
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
      const validationError = validateImageFile(logoFile, "Logo");
      if (validationError) return { error: validationError, success: false };
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
      const validationError = validateImageFile(bgFile, "Imagen de fondo");
      if (validationError) return { error: validationError, success: false };
      try {
        backgroundUrl = await uploadImage(admin, bgFile, "login-background");
      } catch (err) {
        return { error: (err as Error).message, success: false };
      }
    } else if (bgRemove) {
      backgroundUrl = "";
    }

    // Favicon (Nexo Enterprise UI, 2026-09-07): mismo patron upsert +
    // cache-bust que logo/fondo — ver migración
    // 20260907223910_nexo_enterprise_ui_favicon.sql. Fuente recomendada
    // 512x512, sin pipeline de generación de variantes (16/32/48/180/192).
    let faviconUrl: string | null = null;
    const faviconFile = formData.get("favicon");
    const faviconRemove = formData.get("favicon_remove") === "on";
    if (faviconFile instanceof File && faviconFile.size > 0) {
      const validationError = validateImageFile(faviconFile, "Favicon");
      if (validationError) return { error: validationError, success: false };
      try {
        faviconUrl = await uploadImage(admin, faviconFile, "favicon");
      } catch (err) {
        return { error: (err as Error).message, success: false };
      }
    } else if (faviconRemove) {
      faviconUrl = "";
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
      p_favicon_url: faviconUrl,
    });

    if (error) {
      return { error: error.message, success: false };
    }

    revalidatePath("/configuracion/marca");
    revalidatePath("/login");
    revalidatePath("/");
    revalidatePath("/", "layout");

    return { error: null, success: true };
  } catch (err) {
    return {
      error: `No se pudo guardar la configuración de marca: ${(err as Error).message ?? "error desconocido"}.`,
      success: false,
    };
  }
}
