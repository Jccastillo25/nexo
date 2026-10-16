// Copyright, logo y favicon de toda la plataforma (get_platform_settings).
// Duplicado de apps/atencion/src/lib/platform-settings.ts a propósito: cada
// zona de Multi-Zones es independiente. Este módulo solo LEE.

const DEFAULT_COPYRIGHT = "© Grupo CT";

type MinimalSupabaseClient = {
  rpc(fn: "get_platform_settings", args?: object): {
    maybeSingle: () => PromiseLike<{
      data: { copyright_text: string | null; logo_url: string | null; favicon_url: string | null } | null;
      error: unknown;
    }>;
  };
};

async function leer(supabase: MinimalSupabaseClient) {
  const { data, error } = await supabase.rpc("get_platform_settings").maybeSingle();
  return error ? null : data;
}

export async function getCopyrightText(supabase: MinimalSupabaseClient): Promise<string> {
  return (await leer(supabase))?.copyright_text ?? DEFAULT_COPYRIGHT;
}

export async function getLogoUrl(supabase: MinimalSupabaseClient): Promise<string | null> {
  return (await leer(supabase))?.logo_url ?? null;
}

export async function getFaviconUrl(supabase: MinimalSupabaseClient): Promise<string | null> {
  return (await leer(supabase))?.favicon_url ?? null;
}
