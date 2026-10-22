import type { Contexto } from "@nexo/auth";
import { mensajeUsuario } from "@/lib/metas/errores";
import type { Indicadores } from "@/lib/metas/tipos";

/** Lo que necesitan las vistas del Dashboard de presupuesto_indicadores, ya traducido. */
export interface ResultadoIndicadores {
  /** null si la RPC falló o no respondió. */
  indicadores: Indicadores | null;
  /** Mensaje para el usuario si falló (ya registrado en el servidor). */
  error: string | null;
}

/**
 * Lanza public.presupuesto_indicadores y devuelve la promesa SIN esperarla:
 * es la RPC más lenta del Dashboard y es un complemento, así que la página
 * pinta el número del mes y el equipo con las otras RPC y los indicadores
 * llegan después dentro de <Suspense>. La consulta sale en el momento de la
 * llamada (await dentro de la función). Nunca rechaza: un error vuelve como
 * `error`, para que la promesa suelta no termine en un rechazo sin manejar.
 */
export async function cargarIndicadores(
  { supabase, companyId }: Contexto,
  anio: number,
  mes: number,
  vista: "propio" | "equipo"
): Promise<ResultadoIndicadores> {
  try {
    const { data, error } = await supabase.rpc("presupuesto_indicadores", {
      p_company_id: companyId,
      p_anio: anio,
      p_mes: mes,
      p_vista: vista,
    });
    if (error) {
      return { indicadores: null, error: mensajeUsuario(error, "presupuesto_indicadores", "No se pudieron cargar los indicadores.") };
    }
    return { indicadores: (data ?? null) as Indicadores | null, error: null };
  } catch (err) {
    return { indicadores: null, error: mensajeUsuario(err, "presupuesto_indicadores", "No se pudieron cargar los indicadores.") };
  }
}
