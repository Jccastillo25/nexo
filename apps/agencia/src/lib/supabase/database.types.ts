// Superficie de lectura del esquema public de nexo-core usada por esta app.
export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      has_permission: {
        Args: { p_code: string; p_company_id: string };
        Returns: boolean;
      };
      get_platform_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          logo_url: string | null;
          favicon_url: string | null;
          copyright_text: string | null;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
