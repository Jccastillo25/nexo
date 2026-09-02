import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expedientes · RRHH",
};

/**
 * Placeholder de ruta — este turno construyo la estructura base
 * (Dashboard/Expedientes/Kiosco/Planillas) y la pantalla del Kiosco, no
 * el CRUD completo de expedientes (fuera de alcance pedido). El item de
 * navegacion ya existe y apunta aca para que la estructura del modulo
 * quede completa.
 */
export default function ExpedientesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-white">Expedientes</h1>
      <div className="nexo-glass rounded-2xl px-5 py-8 text-center text-sm text-white/50">
        Listado y alta de empleados — pendiente de construir en un turno
        aparte (crea contra{" "}
        <code className="text-white/70">rrhh.fn_crear_empleado</code>).
      </div>
    </div>
  );
}
