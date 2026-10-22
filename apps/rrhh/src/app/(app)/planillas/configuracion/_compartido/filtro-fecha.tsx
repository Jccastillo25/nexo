"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, ButtonLink, Field, Input } from "@nexo/ui";
import { esFechaIso } from "@/lib/planilla/periodos";

/**
 * Fecha de corte de una pantalla de análisis (`?fecha=YYYY-MM-DD`), en la URL
 * para que "Atrás" y un enlace compartido repitan la consulta. Conserva los
 * demás parámetros. La fecha de hoy no se escribe (es el valor por defecto).
 *
 * Monta este componente con `key={fecha}`: así vuelve al valor de la URL
 * después de navegar (también con Atrás) sin sincronizar estado en un efecto.
 */
export function FiltroFecha({
  fecha,
  hoy,
  label,
  hrefHoy,
  param = "fecha",
}: {
  /** Fecha de la URL, ya validada por la página. */
  fecha: string;
  /** Hoy en Managua (valor por defecto). */
  hoy: string;
  label: string;
  /** Ruta de la pantalla sin la fecha (vuelve a hoy). */
  hrefHoy: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [valor, setValor] = useState(fecha);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function consultar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!esFechaIso(valor)) {
      setError("Indica una fecha válida.");
      return;
    }
    setError(null);
    const sp = new URLSearchParams(window.location.search);
    if (valor === hoy) sp.delete(param);
    else sp.set(param, valor);
    const query = sp.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  return (
    <form onSubmit={consultar} className="flex flex-wrap items-end gap-3" aria-busy={pendiente}>
      <Field label={label} error={error ?? undefined} className="w-48">
        <Input type="date" value={valor} onChange={(e) => setValor(e.target.value)} required />
      </Field>
      <Button type="submit" variant="secondary" loading={pendiente}>
        Consultar
      </Button>
      {fecha !== hoy ? (
        <ButtonLink href={hrefHoy} variant="link" className="pb-2">
          Ver a hoy
        </ButtonLink>
      ) : null}
    </form>
  );
}
