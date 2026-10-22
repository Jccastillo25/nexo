"use client";

import type { ReactNode } from "react";
import { Alert } from "@nexo/ui";

/** Función estable: React la llama solo al montar el aviso, no en cada render. */
function enfocar(el: HTMLDivElement | null) {
  el?.focus();
}

/**
 * Error de un formulario o de un diálogo del Paquete C (Prestaciones):
 * vacaciones, préstamos, embargos y liquidaciones. Un solo canal, sin toast.
 * Al aparecer recibe el foco (y el navegador lo desplaza a la vista), así
 * quien usa teclado o lector de pantalla llega al mensaje. Para que un error
 * repetido vuelva a enfocarse, limpia el error (null) antes de cada intento:
 * el aviso se desmonta y se vuelve a montar.
 *
 * Mismo componente que configuracion/_compartido/alerta-error.tsx (paquete
 * A). Candidato a generalizarse en @nexo/ui como una opción de Alert (pedido
 * al coordinador).
 */
export function AlertaError({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div ref={enfocar} tabIndex={-1} className="rounded-lg outline-none">
      <Alert tone="error" title={title}>
        {children}
      </Alert>
    </div>
  );
}
