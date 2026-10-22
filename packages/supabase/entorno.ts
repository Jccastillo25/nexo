// URL y clave pública de nexo-core, compartidas por los clientes de este
// paquete. Se leen con `process.env.NEXT_PUBLIC_*` literal para que Next las
// incruste también en el bundle del navegador (client.ts).

/** Devuelve la URL y la clave anónima del proyecto, o lanza un error que nombra la variable que falta. */
export function urlYClavePublica(): { url: string; clave: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) {
    throw new Error(
      `Falta ${!url ? "NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"} en las variables de entorno de este deploy.`
    );
  }
  return { url, clave };
}
