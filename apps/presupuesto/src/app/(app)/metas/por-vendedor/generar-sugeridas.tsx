"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@nexo/ui";
import { nombreMes } from "@/lib/metas/periodo";
import { generarSugeridas } from "./actions";

/**
 * "Generar metas sugeridas": conserva las ajustadas a mano. Con la casilla
 * marcada también las reemplaza, y eso pide confirmación.
 */
export function GenerarSugeridas({
  anio,
  mes,
  conOpcionReemplazar = false,
}: {
  anio: number;
  mes: number;
  conOpcionReemplazar?: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const idCasilla = useId();
  const [reemplazar, setReemplazar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generar() {
    setError(null);
    startTransition(async () => {
      const res = await generarSugeridas(anio, mes, reemplazar);
      setConfirmar(false);
      if (!res.ok) {
        setError(res.message ?? "No se pudieron generar las metas.");
        return;
      }
      show(`Metas sugeridas de ${nombreMes(mes)} generadas.`, "success");
      setReemplazar(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => (reemplazar ? setConfirmar(true) : generar())} loading={isPending}>
          {isPending ? "Generando…" : "Generar metas sugeridas"}
        </Button>
        {conOpcionReemplazar ? (
          <label htmlFor={idCasilla} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              id={idCasilla}
              type="checkbox"
              checked={reemplazar}
              onChange={(e) => setReemplazar(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            Reemplazar también las metas ajustadas a mano
          </label>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmar}
        title="Reemplazar las metas ajustadas"
        description={`Las metas de ${nombreMes(mes)} de ${anio} que ajustó un gerente se cambian por la sugerida. Esto no se puede deshacer.`}
        confirmLabel="Reemplazar metas"
        destructive
        pending={isPending}
        onConfirm={generar}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  );
}
