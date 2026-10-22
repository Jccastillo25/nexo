import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { contratosOpciones } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { FalloLectura, SinAcceso } from "../../liquidaciones/_compartido/fallo-lectura";
import { NuevoPrestamoForm } from "./nuevo-prestamo-form";

export const metadata: Metadata = {
  title: "Nuevo préstamo · RRHH",
};

const ACCESO = { pantalla: "Nuevo préstamo", permiso: "Gestionar préstamos" };

/**
 * Nuevo préstamo o adelanto (C4), con prestamos.gestionar. Solo contratos
 * activos (lo exige planilla_prestamo_crear). Sin vista previa del plan de
 * cuotas (D13): las cuotas se ven en la ficha al guardar.
 */
export default async function NuevoPrestamoPage() {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  const volver = permisos.prestamosVer ? { href: RUTA.prestamos(), label: "Préstamos y adelantos" } : undefined;

  if (!permisos.prestamosGestionar) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Nuevo préstamo" back={volver} />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const opcionesR = await contratosOpciones(ctx);
  const encabezado = (
    <PageHeader
      title="Nuevo préstamo"
      description="Préstamo o adelanto salarial que se descuenta por cuotas en la planilla."
      back={volver}
    />
  );

  if (!opcionesR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={opcionesR} titulo="No se pudo cargar la lista de contratos" acceso={ACCESO} />
      </div>
    );
  }

  const personas = opcionesR.valor
    .filter((c) => c.estado === "activo")
    .map((c) => ({ contratoId: c.contrato_id, etiqueta: c.etiqueta }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {encabezado}
      {personas.length === 0 ? (
        <Alert tone="info" title="No hay contratos activos">
          Solo se registran préstamos y adelantos de contratos activos.
        </Alert>
      ) : (
        <NuevoPrestamoForm personas={personas} hoy={hoyManagua()} puedeVerLista={permisos.prestamosVer} />
      )}
    </div>
  );
}
