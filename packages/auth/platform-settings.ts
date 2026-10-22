import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAnonClient } from "@nexo/supabase";

// Marca de toda la plataforma (logo, fondo del login, favicon, textos,
// bullets, copyright), ver supabase/migrations/20260830000011_platform_settings.sql
// y 20260907223910_nexo_enterprise_ui_favicon.sql. Las zonas solo LEEN; la
// edición vive en apps/nexo/configuracion/marca (update_platform_settings).
//
// Un solo lugar con los valores por defecto: si la RPC falla (red, proyecto
// pausado), el login y la suite siguen mostrando algo razonable.
//
// Caché: `unstable_cache` (entre requests, 300 s, etiqueta "platform-settings")
// y `cache` de React (una lectura por request). En Next 16.3 la documentación
// recomienda `"use cache"`, pero exige `cacheComponents: true`, que cambia el
// render de toda la app; `unstable_cache` es la API vigente sin ese flag
// (node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md).
// Cada zona de Multi-Zones tiene su propia caché: revalidar en el panel no
// limpia la de los módulos, que se actualizan solos en ≤ 300 s.

export const ETIQUETA_PLATFORM_SETTINGS = "platform-settings";

export interface PlatformBullet {
  icon: string;
  title: string;
  description: string;
}

export interface PlatformSettings {
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  faviconUrl: string | null;
  eyebrowText: string;
  headingText: string;
  tagline: string;
  bullets: PlatformBullet[];
  copyrightText: string;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  logoUrl: null,
  loginBackgroundUrl: null,
  faviconUrl: null,
  eyebrowText: "Grupo CT",
  headingText: "Nexo",
  tagline: "El panel unificado de Materiales J Castillo / Grupo CT.",
  bullets: [
    {
      icon: "shield",
      title: "Permisos por módulo",
      description: "Cada cuenta ve únicamente lo que tiene habilitado.",
    },
    {
      icon: "key",
      title: "Un solo inicio de sesión",
      description: "Entra a todos los módulos con un solo inicio de sesión.",
    },
    {
      icon: "layers",
      title: "Todo en un solo panel",
      description: "RRHH, Asistencia, Atención y más, en un mismo lugar.",
    },
  ],
  copyrightText: "© Grupo CT",
};

/** Fila de public.get_platform_settings (returns table, una fila con id = 1). */
interface FilaPlatformSettings {
  logo_url: string | null;
  login_background_url: string | null;
  favicon_url: string | null;
  eyebrow_text: string | null;
  heading_text: string | null;
  tagline: string | null;
  bullets: unknown;
  copyright_text: string | null;
}

function normalizar(fila: FilaPlatformSettings | null): PlatformSettings {
  if (!fila) return DEFAULT_PLATFORM_SETTINGS;
  const d = DEFAULT_PLATFORM_SETTINGS;
  return {
    logoUrl: fila.logo_url ?? null,
    loginBackgroundUrl: fila.login_background_url ?? null,
    faviconUrl: fila.favicon_url ?? null,
    eyebrowText: fila.eyebrow_text ?? d.eyebrowText,
    headingText: fila.heading_text ?? d.headingText,
    tagline: fila.tagline ?? d.tagline,
    bullets: Array.isArray(fila.bullets) ? (fila.bullets as PlatformBullet[]) : d.bullets,
    copyrightText: fila.copyright_text ?? d.copyrightText,
  };
}

// Cliente anónimo: get_platform_settings es ejecutable por anon y dentro de
// unstable_cache no se pueden leer cookies. Un error se LANZA para que no se
// guarde en caché; getPlatformSettings lo convierte en los valores por defecto.
const leerCacheado = unstable_cache(
  async (): Promise<PlatformSettings> => {
    const { data, error } = await createAnonClient().rpc("get_platform_settings").maybeSingle();
    if (error) throw error;
    return normalizar(data as FilaPlatformSettings | null);
  },
  ["nexo-platform-settings"],
  { revalidate: 300, tags: [ETIQUETA_PLATFORM_SETTINGS] }
);

/**
 * Marca de la plataforma, sin cookies y cacheada entre requests (300 s,
 * etiqueta "platform-settings"). Nunca lanza: ante un error devuelve
 * DEFAULT_PLATFORM_SETTINGS (y ese fallo no queda en caché).
 */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    return await leerCacheado();
  } catch (err) {
    console.error("get_platform_settings", err);
    return DEFAULT_PLATFORM_SETTINGS;
  }
});

/**
 * Invalida la marca cacheada de ESTA zona al instante (la próxima lectura va a
 * la base). Para la acción de Configuración → Marca del panel, después de
 * update_platform_settings. Solo en Server Actions o Route Handlers.
 */
export function revalidarPlatformSettings(): void {
  revalidateTag(ETIQUETA_PLATFORM_SETTINGS, { expire: 0 });
}
