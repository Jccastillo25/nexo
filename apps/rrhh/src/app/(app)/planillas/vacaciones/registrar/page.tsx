import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc, contratosOpciones } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import type { VacacionSaldo } from "@/lib/planilla/tipos";
import { FalloLectura, SinAcceso } from "../../liquidaciones/_compartido/fallo-lectura";
import { RegistrarVacacionesForm, type PersonaVacaciones } from "./registrar-form";

export const metadata: Metadata = {
  title: "Registrar vacaciones · RRHH",
};

const ACCESO = { pantalla: "Registrar vacaciones", permiso: "Registrar vacaciones" };

/**
 * Registrar vacaciones (C3), con vacaciones.registrar. Personas de
 * planilla_contratos_opciones (activos y finalizados). El "Saldo al día de
 * hoy" sale de planilla_vacaciones_saldos solo si el rol también puede ver
 * vacaciones; si no, el formulario funciona sin ese contexto.
 */
export default async function RegistrarVacacionesPage({ searchParams }: PageProps<"/planillas/vacaciones/registrar">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  const volver = permisos.vacacionesVer ? { href: RUTA.vacaciones(), label: "Vacaciones" } : undefined;

  if (!permisos.vacacionesRegistrar) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Registrar vacaciones" back={volver} />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const hoy = hoyManagua();
  const [opcionesR, saldosR] = await Promise.all([
    contratosOpciones(ctx),
    permisos.vacacionesVer
      ? consultarRpc<VacacionSaldo[]>(ctx, "planilla_vacaciones_saldos", { p_fecha: hoy }, "planilla_vacaciones_saldos")
      : Promise.resolve(null),
  ]);

  const encabezado = (
    <PageHeader
      title="Registrar vacaciones"
      description="El movimiento queda por aprobar: lo aprueba una persona distinta de quien lo registra."
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

  const saldoPorContrato = new Map<string, number>();
  if (saldosR?.ok && Array.isArray(saldosR.valor)) {
    for (const s of saldosR.valor) saldoPorContrato.set(s.contrato_id, s.saldo);
  }

  const personas: PersonaVacaciones[] = opcionesR.valor.map((c) => ({
    contratoId: c.contrato_id,
    etiqueta: c.etiqueta,
    fechaInicio: c.fecha_inicio,
    fechaFin: c.fecha_fin_real,
    saldoHoy: saldoPorContrato.get(c.contrato_id) ?? null,
  }));
  const contratoParam = Array.isArray(sp.contrato) ? sp.contrato[0] : sp.contrato;
  const inicial = esUuid(contratoParam) && personas.some((p) => p.contratoId === contratoParam) ? contratoParam : "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {encabezado}
      {personas.length === 0 ? (
        <Alert tone="info" title="No hay contratos para registrar vacaciones">
          Solo se registran vacaciones de contratos activos o finalizados.
        </Alert>
      ) : (
        <RegistrarVacacionesForm
          personas={personas}
          contratoInicial={inicial}
          hoy={hoy}
          verSaldo={saldosR?.ok === true}
          puedeVerMovimientos={permisos.vacacionesVer}
        />
      )}
    </div>
  );
}
