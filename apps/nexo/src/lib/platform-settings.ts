type MinimalSupabaseClient = {
  rpc(fn: "get_platform_settings", args?: object): {
    maybeSingle: () => PromiseLike<{ data: RawPlatformSettings | null; error: unknown }>;
  };
};

interface RawPlatformSettings {
  logo_url: string | null;
  login_background_url: string | null;
  eyebrow_text: string | null;
  heading_text: string | null;
  tagline: string | null;
  bullets: unknown;
  copyright_text: string | null;
}

// Config de marca de Nexo (logo, imagen de fondo del login, textos,
// bullets, copyright de toda la plataforma) — ver
// supabase/migrations/20260830000011_platform_settings.sql. Un solo lugar
// con los defaults, para que si la RPC falla (red, proyecto pausado, etc.)
// el login y el resto de la suite sigan mostrando algo razonable en vez de
// romperse.

export interface PlatformBullet {
  icon: string;
  title: string;
  description: string;
}

export interface PlatformSettings {
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  eyebrowText: string;
  headingText: string;
  tagline: string;
  bullets: PlatformBullet[];
  copyrightText: string;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  logoUrl: null,
  loginBackgroundUrl: null,
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
      description: "Entrá a todos los módulos sin volver a loguearte.",
    },
    {
      icon: "layers",
      title: "Todo en un solo panel",
      description: "CRM, RRHH y Flotilla, unificados en un mismo lugar.",
    },
  ],
  copyrightText: "© Grupo CT",
};

export async function getPlatformSettings(
  supabase: MinimalSupabaseClient
): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .rpc("get_platform_settings")
    .maybeSingle();

  if (error || !data) return DEFAULT_PLATFORM_SETTINGS;

  const bullets = Array.isArray(data.bullets)
    ? (data.bullets as PlatformBullet[])
    : DEFAULT_PLATFORM_SETTINGS.bullets;

  return {
    logoUrl: data.logo_url ?? null,
    loginBackgroundUrl: data.login_background_url ?? null,
    eyebrowText: data.eyebrow_text ?? DEFAULT_PLATFORM_SETTINGS.eyebrowText,
    headingText: data.heading_text ?? DEFAULT_PLATFORM_SETTINGS.headingText,
    tagline: data.tagline ?? DEFAULT_PLATFORM_SETTINGS.tagline,
    bullets,
    copyrightText:
      data.copyright_text ?? DEFAULT_PLATFORM_SETTINGS.copyrightText,
  };
}
