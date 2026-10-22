"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Field, Input } from "@nexo/ui";
import { RUTA } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";

/**
 * "Saldo al" de la pantalla de saldos: la fecha vive en la URL (`?fecha=`).
 * "Consultar" valida el formato y navega; el Server Component vuelve a
 * consultar planilla_vacaciones_saldos con esa fecha.
 */
export function FiltroFecha({ fecha, hoy }: { fecha: string; hoy: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(fecha);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  function consultar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!esFechaIso(valor)) {
      setError("Indica una fecha válida.");
      campo.current?.focus();
      return;
    }
    setError(null);
    startTransition(() => router.push(RUTA.vacaciones({ fecha: valor === hoy ? undefined : valor })));
  }

  return (
    <form onSubmit={consultar} noValidate aria-label="Fecha del saldo" className="flex w-full flex-wrap items-end gap-3">
      <Field label="Saldo al" required error={error ?? undefined} className="w-full sm:w-44">
        <Input
          ref={campo}
          type="date"
          required
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            if (error) setError(null);
          }}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={pendiente}>
        {pendiente ? "Consultando…" : "Consultar"}
      </Button>
      {fecha !== hoy ? (
        <ButtonLink href={RUTA.vacaciones()} variant="link" className="pb-2">
          Volver a hoy
        </ButtonLink>
      ) : null}
    </form>
  );
}
