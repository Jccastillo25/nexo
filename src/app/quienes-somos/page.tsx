import type { Metadata } from "next";
import ContenidoPendiente from "@/components/ContenidoPendiente";
import { EMPRESA } from "@/data/empresa";

export const metadata: Metadata = {
  title: `Quiénes somos · ${EMPRESA.nombre}`,
};

export default function QuienesSomosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl text-acero">Quiénes somos</h1>

      <div className="mt-6">
        <ContenidoPendiente>
          <p>
            Falta el texto real de presentación de {EMPRESA.nombre} (historia,
            misión, años operando, equipo, etc.). Pásamelo y lo pongo aquí.
          </p>
        </ContenidoPendiente>
      </div>
    </div>
  );
}
