import type { ReactNode } from "react";

/**
 * Sección del Inicio: título (h2), contexto en una línea y una acción
 * opcional a la derecha ("Ver reportes"). Las tarjetas van debajo, sin otra
 * tarjeta que las envuelva.
 */
export default function Bloque({
  id,
  titulo,
  descripcion,
  accion,
  children,
}: {
  id: string;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold text-neutral-900">
            {titulo}
          </h2>
          {descripcion ? <p className="text-sm text-neutral-500">{descripcion}</p> : null}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}
