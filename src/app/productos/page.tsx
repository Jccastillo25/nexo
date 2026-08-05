import type { Metadata } from "next";
import ContenidoPendiente from "@/components/ContenidoPendiente";
import { CATEGORIAS } from "@/data/productos";
import { EMPRESA } from "@/data/empresa";

export const metadata: Metadata = {
  title: `Productos · ${EMPRESA.nombre}`,
};

export default function ProductosPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl text-acero">Productos</h1>

      {CATEGORIAS.length === 0 ? (
        <div className="mt-6">
          <ContenidoPendiente>
            <p>
              Falta el catálogo real (categorías y productos). Está listo el
              archivo{" "}
              <code className="rounded bg-acero/10 px-1 py-0.5">
                src/data/productos.ts
              </code>{" "}
              para llenarlo — pásame la lista y la agrego.
            </p>
          </ContenidoPendiente>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {CATEGORIAS.map((categoria) => (
            <section key={categoria.slug}>
              <h2 className="font-display text-xl text-acero">
                {categoria.titulo}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoria.productos.map((producto) => (
                  <li
                    key={producto.nombre}
                    className="rounded-md border border-acero-medio/15 bg-white/50 p-4"
                  >
                    <p className="font-medium text-acero">
                      {producto.nombre}
                    </p>
                    {producto.descripcion && (
                      <p className="mt-1 font-mono text-xs text-acero-medio">
                        {producto.descripcion}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
