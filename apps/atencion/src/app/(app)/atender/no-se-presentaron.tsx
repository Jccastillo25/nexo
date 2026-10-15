"use client";

import { useTransition } from "react";
import { FormSection, useToast } from "@nexo/ui";
import type { TurnoCola } from "@/lib/supabase/database.types";
import { reactivarTurno } from "../actions";
import { horaCorta } from "./use-cola";

/**
 * Turnos de hoy marcados "No se presentó". Con atencion.cola.turno.reactivar
 * se devuelven a la fila, al final, con su mismo número. Sin el permiso la
 * sección no se muestra.
 */
export default function NoSePresentaron({
  cola,
  puedeReactivar,
  alReactivar,
}: {
  cola: TurnoCola[];
  puedeReactivar: boolean;
  alReactivar: () => Promise<void>;
}) {
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const ausentes = cola.filter((t) => t.estado === "ausente" && !t.reemplazado);

  if (!puedeReactivar || ausentes.length === 0) return null;

  function reactivar(t: TurnoCola) {
    startTransition(async () => {
      const res = await reactivarTurno(t.id);
      show(
        res.ok ? `Turno ${t.numero} reactivado: vuelve al final de la fila.` : res.message ?? "No se pudo reactivar.",
        res.ok ? "success" : "error"
      );
      await alReactivar();
    });
  }

  return (
    <FormSection title={`No se presentaron hoy (${ausentes.length})`}>
      <ul className="divide-y divide-neutral-100">
        {ausentes.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-3">
              <span className="w-12 text-xl font-bold tabular-nums text-neutral-500">{t.numero}</span>
              <div>
                <p className="text-sm font-medium text-neutral-700">{t.cliente_nombre}</p>
                <p className="text-xs text-neutral-400">
                  {t.factura ? `Factura ${t.factura} · ` : ""}
                  marcado a las {horaCorta(t.finalizado_en)}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => reactivar(t)}
              className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              Reactivar
            </button>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}
