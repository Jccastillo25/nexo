// Copyright de toda la plataforma — ver
// supabase/migrations/20260830000011_platform_settings.sql. Duplicado de
// apps/nexo/src/lib/platform-settings.ts a proposito (cada zona de
// Multi-Zones es independiente, no comparten runtime) — el CRM solo LEE
// (get_platform_settings), la edicion vive unicamente en apps/nexo/ajustes.

const DEFAULT_COPYRIGHT = "© Grupo CT";

type MinimalSupabaseClient = {
  rpc(fn: "get_platform_settings", args?: object): {
    maybeSingle: () => PromiseLike<{
      data: { copyright_text: string | null } | null;
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
