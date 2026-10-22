import { cache } from "react";
import { createServerClient, type SupabaseClient, type User } from "@nexo/supabase";
import { getPermisos } from "@nexo/permissions";
import { getCompanyId } from "./empresa";

// Sesión y permisos por request. `cache` de React memoriza durante UN render
// del servidor (layout, página y generateMetadata de la misma petición
// comparten el resultado); entre peticiones no se comparte nada. Fuera de un
// render (p. ej. dentro de una Server Action) no memoriza: solo llama.

/** Sesión de la petición. El tipo `Db` es solo de TypeScript. */
export interface Sesion<Db = any> {
  supabase: SupabaseClient<Db>;
  /** Usuario validado contra Supabase Auth, o null (el proxy ya redirige sin sesión). */
  user: User | null;
  companyId: string;
}

/** Contexto para RPC y para requirePermission: cliente + empresa, sin llamar a Auth. */
export interface Contexto<Db = any> {
  supabase: SupabaseClient<Db>;
  companyId: string;
}

/** Un solo cliente de servidor por request, compartido por todo lo de abajo. */
const clienteDelRequest = cache(() => createServerClient());

const contextoCacheado = cache(async (): Promise<Contexto> => {
  const companyId = getCompanyId(); // primero lo barato: falla sin tocar la red
  return { supabase: await clienteDelRequest(), companyId };
});

const sesionCacheada = cache(async (): Promise<Sesion> => {
  const { supabase, companyId } = await contextoCacheado();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user, companyId };
});

/**
 * `{ supabase, user, companyId }` con UNA llamada a `auth.getUser()` por
 * request (aparte de la del proxy), compartida entre layout y página. Úsala
 * donde haga falta el usuario (layout: correo del shell).
 */
export function sesionActual<Db = any>(): Promise<Sesion<Db>> {
  return sesionCacheada() as unknown as Promise<Sesion<Db>>;
}

/**
 * `{ supabase, companyId }` sin llamar a Auth: para páginas que solo consultan
 * RPC (las RPC validan el JWT y el permiso en la base) y como contexto de
 * `requirePermission`. Evita pagar `getUser()` en cada navegación interna,
 * donde el layout no se vuelve a renderizar.
 */
export function contextoActual<Db = any>(): Promise<Contexto<Db>> {
  return contextoCacheado() as unknown as Promise<Contexto<Db>>;
}

/** Separador de la clave de caché; ningún código de permiso lleva coma. */
const SEPARADOR = ",";

const permisosPorClave = cache(async (clave: string): Promise<ReadonlySet<string>> => {
  const ctx = await contextoCacheado();
  return getPermisos(ctx, clave.split(SEPARADOR));
});

/**
 * Permisos del usuario de la sesión entre `codigos`, para la UI. Cacheada por
 * request con una clave estable (códigos sin repetir, ordenados y unidos): el
 * mismo conjunto pedido desde el layout y desde la página hace UNA consulta.
 * Pide siempre la misma lista en toda la app (p. ej. todos los de `P`), o
 * cada lista distinta será otra consulta. No reemplaza a requirePermission.
 */
export function misPermisos(codigos: readonly string[]): Promise<ReadonlySet<string>> {
  const clave = [...new Set(codigos)].sort().join(SEPARADOR);
  return permisosPorClave(clave);
}
