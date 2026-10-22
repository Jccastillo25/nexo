import type { ReactNode } from "react";

/**
 * Celda "Persona" de las tablas del Paquete C: nombre y, debajo, el número
 * de contrato en gris. Sin "use client": sirve en Server Components y dentro
 * de componentes cliente.
 */
export function CeldaPersona({ nombre, numero, extra }: { nombre: string; numero: number; extra?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium text-neutral-900">{nombre}</span>
      <span className="text-xs text-neutral-500 tabular-nums">Contrato N.º {numero}</span>
      {extra ? <span className="text-xs text-neutral-500">{extra}</span> : null}
    </span>
  );
}

/** "Nombre · N.º 12" para opciones de filtros armadas con las filas de una RPC. */
export function etiquetaPersona(nombre: string, numero: number): string {
  return `${nombre} · N.º ${numero}`;
}
