import { TabLinks } from "@nexo/ui";
import { RUTA } from "@/lib/planilla/rutas";

/** Pestañas "Saldos" / "Movimientos" de Vacaciones (enlaces, con la activa explícita). */
export function PestanasVacaciones({ activa, porAprobar }: { activa: "saldos" | "movimientos"; porAprobar?: number | null }) {
  return (
    <TabLinks
      label="Secciones de vacaciones"
      items={[
        { label: "Saldos", href: RUTA.vacaciones(), active: activa === "saldos" },
        {
          label: "Movimientos",
          href: RUTA.vacacionesMovimientos(),
          active: activa === "movimientos",
          badge:
            porAprobar && porAprobar > 0 ? (
              <>
                {porAprobar}
                <span className="sr-only"> por aprobar</span>
              </>
            ) : undefined,
        },
      ]}
    />
  );
}
