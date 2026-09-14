// Copyright y logo de toda la plataforma — ver
// supabase/migrations/20260830000011_platform_settings.sql. Duplicado de
// apps/nexo/src/lib/platform-settings.ts a proposito (cada zona de
// Multi-Zones es independiente, no comparten runtime) — el CRM solo LEE
// (get_platform_settings), la edicion vive unicamente en
// apps/nexo/configuracion/marca. Mismo patron que
// apps/rrhh/src/lib/platform-settings.ts (getLogoUrl).

const DEFAULT_COPYRIGHT = "© Grupo CT";

type MinimalSupabaseClient = {
  rpc(fn: "get_platform_settings", args?: object): {
    maybeSingle: () => PromiseLike<{
      data: { copyright_text: string | null; logo_url: string | null } | null;
      error: unknown;
    }>;
  };
};

export async function getCopyrightText(
  supabase: MinimalSupabaseClient
): Promise<string> {
  const { data, error } = await supabase
    .rpc("get_platform_settings")
    .maybeSingle();

  if (error || !data) return DEFAULT_COPYRIGHT;
  return data.copyright_text ?? DEFAULT_COPYRIGHT;
}

// Logo (reconciliacion de navegacion 2026-09-14): vive en la cabecera del
// sidebar (NexoShell logoUrl → NexoSidebar) — antes el CRM no lo pedía en
// absoluto y su topbar caía siempre al wordmark por defecto.
export async function getLogoUrl(
  supabase: MinimalSupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .rpc("get_platform_settings")
    .maybeSingle();

  if (error || !data) return null;
  return data.logo_url ?? null;
}
