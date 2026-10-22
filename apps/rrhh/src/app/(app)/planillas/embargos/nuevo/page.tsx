import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { contratosOpciones } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { FalloLectura, SinAcceso } from "../../liquidaciones/_compartido/fallo-lectura";
import { NuevoEmbargoForm } from "./nuevo-embargo-form";

export const metadata: Metadata = {
  title: "Nuevo embargo · RRHH",
};

const ACCESO = { pantalla: "Nuevo embargo", permiso: "Gestionar préstamos" };

/** Nuevo embargo (C5), con prestamos.gestionar. Solo contratos activos (lo exige planilla_embargo_crear). */
export default async function NuevoEmbargoPage() {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  const volver = permisos.prestamosVer ? { href: RUTA.embargos(), label: "Embargos" } : undefined;

  if (!permisos.prestamosGestionar) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Nuevo embargo" back={volver} />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const opcionesR = await contratosOpciones(ctx);
  const encabezado = (
    <PageHeader
      title="Nuevo embargo"
      description="Orden de pensión alimenticia o embargo judicial que se descuenta en la planilla."
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
    .map((c) => ({ contratoId: c.contrato_id, etiqueta: c.etiqueta, fechaInicio: c.fecha_inicio }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {encabezado}
      {personas.length === 0 ? (
        <Alert tone="info" title="No hay contratos activos">
          Solo se registran embargos de contratos activos.
        </Alert>
      ) : (
        <NuevoEmbargoForm personas={personas} hoy={hoyManagua()} puedeVerLista={permisos.prestamosVer} />
      )}
    </div>
  );
}
