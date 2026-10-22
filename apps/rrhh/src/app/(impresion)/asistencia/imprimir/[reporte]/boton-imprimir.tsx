"use client";

/** Abre el diálogo de impresión del navegador. No se imprime a sí mismo. */
export default function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 print:hidden"
    >
      Imprimir
    </button>
  );
}
