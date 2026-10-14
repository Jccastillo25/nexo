import type { PermisoCatalogo } from "@/lib/supabase/database.types";

/**
 * Agrupa el catálogo de public.admin_catalogo_permisos para el editor de
 * roles (opción A, decisión del usuario 2026-10-14): app → dominio →
 * recurso → permisos. Puro (sin server-only) porque lo usan tanto la página
 * (Server Component) como el formulario (Client Component).
 *
 * Convención de códigos: `[app].[dominio].[recurso].[accion]` (4 segmentos);
 * `<app>.ver_modulo` es el acceso a la app (dominio "acceso"); los códigos
 * heredados de 3 segmentos (`nexo.configuracion.editar`) usan el dominio
 * como recurso.
 */
export interface PermisoItem {
  code: string;
  label: string;
  description: string | null;
}

export interface RecursoGrupo {
  key: string;
  label: string;
  permisos: PermisoItem[];
}

export interface DominioGrupo {
  key: string;
  label: string;
  recursos: RecursoGrupo[];
}

export interface AppGrupo {
  slug: string;
  nombre: string;
  /** `<slug>.ver_modulo`: tenerlo en el rol = acceso a la app. */
  accesoCode: string | null;
  dominios: DominioGrupo[];
  /** Todos los códigos de la app, incluido el de acceso. */
  codes: string[];
}

export function humanizar(key: string): string {
  const texto = key.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function agruparCatalogo(catalogo: PermisoCatalogo[]): AppGrupo[] {
  const apps = new Map<string, AppGrupo>();

  for (const p of catalogo) {
    let app = apps.get(p.module_slug);
    if (!app) {
      app = { slug: p.module_slug, nombre: p.app_nombre, accesoCode: null, dominios: [], codes: [] };
      apps.set(p.module_slug, app);
    }
    app.codes.push(p.code);

    if (p.code === `${p.module_slug}.ver_modulo`) {
      app.accesoCode = p.code;
      continue;
    }

    const partes = p.code.split(".");
    const recursoKey = partes.length >= 4 ? partes[2] : partes[1] ?? p.domain;

    let dominio = app.dominios.find((d) => d.key === p.domain);
    if (!dominio) {
      dominio = { key: p.domain, label: humanizar(p.domain), recursos: [] };
      app.dominios.push(dominio);
    }
    let recurso = dominio.recursos.find((r) => r.key === recursoKey);
    if (!recurso) {
      recurso = { key: recursoKey, label: humanizar(recursoKey), permisos: [] };
      dominio.recursos.push(recurso);
    }
    recurso.permisos.push({ code: p.code, label: p.label, description: p.description });
  }

  return Array.from(apps.values());
}

/** Nombres de apps (con acceso) de un rol, para listados. */
export function appsDelRol(permisos: string[], catalogo: PermisoCatalogo[]): string[] {
  const nombres = new Map(catalogo.map((p) => [p.module_slug, p.app_nombre]));
  return permisos
    .filter((code) => code.endsWith(".ver_modulo"))
    .map((code) => nombres.get(code.slice(0, -".ver_modulo".length)) ?? code)
    .sort((a, b) => a.localeCompare(b, "es"));
}
