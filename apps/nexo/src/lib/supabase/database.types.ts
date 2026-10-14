// Tipos de nexo-core (project ref: yrbjlmiqhkyxtlcerowh), schema public.
// Igual que en apps/crm: escrito a mano porque el generador de tipos del
// MCP solo introspecta "public" (no sigue el toggle de "Exposed schemas"
// del dashboard). Ver docs/DATABASE.md.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_permission: {
        Args: { p_code: string; p_company_id: string };
        Returns: boolean;
      };
      get_visible_apps: {
        Args: { p_company_id: string };
        Returns: {
          slug: string;
          name: string;
          category: string | null;
          icon: string | null;
          color: string | null;
          route: string;
        }[];
      };
      get_platform_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          logo_url: string | null;
          login_background_url: string | null;
          eyebrow_text: string;
          heading_text: string;
          tagline: string;
          bullets: Json;
          copyright_text: string;
        }[];
      };
      update_platform_settings: {
        Args: {
          p_logo_url?: string | null;
          p_login_background_url?: string | null;
          p_eyebrow_text?: string | null;
          p_heading_text?: string | null;
          p_tagline?: string | null;
          p_bullets?: Json | null;
          p_copyright_text?: string | null;
        };
        Returns: undefined;
      };
      // Administración de usuarios y roles (migración 20261014203144_nexo_usuarios_roles_esquema).
      admin_listar_usuarios: {
        Args: { p_company_id: string };
        Returns: {
          user_id: string;
          email: string;
          nombre_completo: string | null;
          telefono: string | null;
          cargo: string | null;
          rol_id: string | null;
          rol_nombre: string | null;
          es_owner: boolean;
          activo: boolean;
          empleado_id: string | null;
          empleado_nombre: string | null;
          debe_cambiar_password: boolean;
          ultimo_ingreso: string | null;
          creado_en: string;
        }[];
      };
      admin_listar_roles: {
        Args: { p_company_id: string };
        Returns: {
          id: string;
          nombre: string;
          descripcion: string | null;
          activo: boolean;
          usuarios: number;
          permisos: string[];
          actualizado_en: string;
        }[];
      };
      admin_catalogo_permisos: {
        Args: { p_company_id: string };
        Returns: {
          module_slug: string;
          app_nombre: string;
          domain: string;
          code: string;
          label: string;
          description: string | null;
        }[];
      };
      admin_plantillas_rol: {
        Args: { p_company_id: string };
        Returns: {
          module_slug: string;
          role_key: string;
          label: string;
          description: string | null;
          permisos: string[];
        }[];
      };
      admin_buscar_empleados: {
        Args: { p_company_id: string; p_texto: string };
        Returns: {
          id: string;
          nombre_completo: string;
          documento_identidad: string | null;
          vinculado_a: string | null;
        }[];
      };
      admin_listar_auditoria: {
        Args: { p_company_id: string; p_limite?: number; p_antes?: string | null };
        Returns: {
          id: string;
          creado_en: string;
          actor_id: string | null;
          actor_email: string | null;
          accion: string;
          entidad: string | null;
          entidad_id: string | null;
          detalle: Json;
        }[];
      };
      mi_perfil: {
        Args: Record<PropertyKey, never>;
        Returns: { nombre_completo: string; debe_cambiar_password: boolean }[];
      };
      admin_guardar_rol: {
        Args: {
          p_company_id: string;
          p_rol_id: string | null;
          p_nombre: string;
          p_descripcion: string | null;
          p_permisos: string[];
        };
        Returns: string;
      };
      admin_eliminar_rol: {
        Args: { p_company_id: string; p_rol_id: string };
        Returns: undefined;
      };
      admin_completar_alta: {
        Args: {
          p_company_id: string;
          p_user_id: string;
          p_nombre_completo: string;
          p_telefono: string | null;
          p_cargo: string | null;
          p_rol_id: string;
          p_empleado_id?: string | null;
        };
        Returns: undefined;
      };
      admin_editar_usuario: {
        Args: {
          p_company_id: string;
          p_user_id: string;
          p_nombre_completo: string;
          p_telefono: string | null;
          p_cargo: string | null;
          p_rol_id: string | null;
          p_empleado_id?: string | null;
        };
        Returns: undefined;
      };
      admin_cambiar_estado_usuario: {
        Args: { p_company_id: string; p_user_id: string; p_activo: boolean };
        Returns: undefined;
      };
      admin_marcar_password_temporal: {
        Args: { p_company_id: string; p_user_id: string };
        Returns: undefined;
      };
      confirmar_cambio_password: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type VisibleApp =
  Database["public"]["Functions"]["get_visible_apps"]["Returns"][number];

type Fn = Database["public"]["Functions"];
export type AdminUsuario = Fn["admin_listar_usuarios"]["Returns"][number];
export type AdminRol = Fn["admin_listar_roles"]["Returns"][number];
export type PermisoCatalogo = Fn["admin_catalogo_permisos"]["Returns"][number];
export type PlantillaRol = Fn["admin_plantillas_rol"]["Returns"][number];
export type EmpleadoBusqueda = Fn["admin_buscar_empleados"]["Returns"][number];
export type EventoAuditoria = Fn["admin_listar_auditoria"]["Returns"][number];
