// Logo de toda la plataforma — ver
// supabase/migrations/20260830000011_platform_settings.sql. Duplicado de
// apps/nexo/src/lib/platform-settings.ts a proposito (cada zona de
// Multi-Zones es independiente, no comparten runtime) — RRHH solo LEE
// (get_platform_settings), la edicion vive unicamente en
// apps/nexo/configuracion/marca. Mismo patron que
// apps/crm/src/lib/platform-settings.ts (getCopyrightText).

type MinimalSupabaseClient = {
  rpc(fn: "get_platform_settings", args?: object): {
    maybeSingle: () => PromiseLike<{
      data: { logo_url: string | null; favicon_url: string | null } | null;
      error: unknown;
    }>;
  };
};

export async function getLogoUrl(supabase: MinimalSupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_platform_settings").maybeSingle();

  if (error || !data) return null;
  return data.logo_url ?? null;
}

// Favicon dinamico (Fase 1 del bloque pre-F1.5): mismo RPC/columna que ya
// usa apps/nexo desde 2026-09-07 — RRHH nunca lo habia consumido.
export async function getFaviconUrl(supabase: MinimalSupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_platform_settings").maybeSingle();

  if (error || !data) return null;
  return data.favicon_url ?? null;
}
