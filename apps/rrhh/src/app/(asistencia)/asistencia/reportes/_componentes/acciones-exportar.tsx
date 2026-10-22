"use client";

import { useTransition } from "react";
import { Button, ButtonLink, NexoIcon, useToast } from "@nexo/ui";
import { nombreArchivo } from "@/lib/reportes-asistencia/formato";
import { rutaImpresion, urlPdf } from "@/lib/reportes-asistencia/rutas";
import type { Reporte } from "@/lib/reportes-asistencia/tipos";

/**
 * "Exportar PDF" e "Imprimir". Solo se monta con
 * rrhh.asistencia.reportes.exportar (la página lo decide en el servidor) y,
 * aun así, el Route Handler y la vista de impresión vuelven a validar.
 *
 * El PDF se pide con fetch (no con un enlace) para poder mostrar en un toast
 * el motivo si el servidor lo rechaza (403/400/422). fetch no aplica el
 * basePath, por eso la URL sale de `urlPdf` (ver lib/reportes-asistencia/rutas.ts).
 * Imprimir usa next/link, que sí aplica el basePath.
 */
export default function AccionesExportar({
  reporte,
  query,
  desde,
  hasta,
}: {
  reporte: Reporte;
  query: string;
  desde: string;
  hasta: string;
}) {
  const toast = useToast();
  const [pendiente, startTransition] = useTransition();

  function descargar() {
    startTransition(async () => {
      try {
        const respuesta = await fetch(urlPdf(reporte, query), { credentials: "same-origin", cache: "no-store" });
        const tipo = respuesta.headers.get("content-type") ?? "";
        if (!respuesta.ok || !tipo.includes("application/pdf")) {
          const cuerpo = tipo.includes("application/json")
            ? ((await respuesta.json().catch(() => null)) as { message?: string } | null)
            : null;
          toast.show(
            cuerpo?.message ??
              (respuesta.ok
                ? "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo."
                : "No se pudo generar el PDF. Intenta de nuevo."),
            "error"
          );
          return;
        }
        const blob = await respuesta.blob();
        const href = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = href;
        enlace.download = nombreArchivo(reporte, desde, hasta);
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        toast.show("PDF descargado.", "success");
      } catch {
        toast.show("No se pudo generar el PDF. Revisa tu conexión e intenta de nuevo.", "error");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={descargar} loading={pendiente} icon={<NexoIcon name="file" />}>
        {pendiente ? "Generando PDF…" : "Exportar PDF"}
      </Button>
      <ButtonLink
        href={rutaImpresion(reporte, query)}
        target="_blank"
        rel="noopener"
        prefetch={false}
        variant="secondary"
        icon={<NexoIcon name="receipt" />}
      >
        Imprimir
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </ButtonLink>
    </>
  );
}
