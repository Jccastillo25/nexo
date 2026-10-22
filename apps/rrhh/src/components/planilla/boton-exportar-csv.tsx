"use client";

import { useTransition } from "react";
import { Button, NexoIcon, useToast, type ButtonSize, type ButtonVariant } from "@nexo/ui";

/** Nombre del archivo que manda el servidor en Content-Disposition. */
function nombreDeCabecera(cabecera: string | null): string | null {
  const m = cabecera ? /filename="?([^";]+)"?/i.exec(cabecera) : null;
  return m ? m[1] : null;
}

/**
 * "Exportar CSV" (planilla o declaración). Mismo patrón que
 * acciones-exportar.tsx de Asistencia: `fetch` con las cookies de la sesión
 * para poder mostrar en un toast el motivo si el servidor lo rechaza
 * (401/403/404 en JSON `{ message }`), y descarga del archivo como blob.
 *
 * `url` debe venir de `urlCsvPlanilla`/`urlCsvDeclaracion` (lib/planilla/rutas.ts):
 * fetch no agrega el basePath. Móntalo solo con el permiso de exportar; el
 * Route Handler vuelve a validarlo.
 */
export function BotonExportarCsv({
  url,
  nombreArchivo = "exportacion.csv",
  label = "Exportar CSV",
  variant = "secondary",
  size = "md",
  disabled = false,
}: {
  url: string;
  /** Nombre de respaldo si el servidor no lo indica. */
  nombreArchivo?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [pendiente, startTransition] = useTransition();

  function descargar() {
    // Solo rutas del mismo sitio (nunca otro origen).
    if (!url.startsWith("/") || url.startsWith("//")) {
      toast.show("No se pudo generar el CSV. Intenta de nuevo.", "error");
      return;
    }
    startTransition(async () => {
      try {
        const respuesta = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        const tipo = respuesta.headers.get("content-type") ?? "";
        if (!respuesta.ok || !tipo.includes("text/csv")) {
          const cuerpo = tipo.includes("application/json")
            ? ((await respuesta.json().catch(() => null)) as { message?: string } | null)
            : null;
          toast.show(
            cuerpo?.message ??
              (respuesta.ok
                ? "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo."
                : "No se pudo generar el CSV. Intenta de nuevo."),
            "error"
          );
          return;
        }
        const blob = await respuesta.blob();
        const href = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = href;
        enlace.download = nombreDeCabecera(respuesta.headers.get("content-disposition")) ?? nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        toast.show("CSV descargado.", "success");
      } catch {
        toast.show("No se pudo generar el CSV. Revisa tu conexión e intenta de nuevo.", "error");
      }
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={descargar}
      loading={pendiente}
      disabled={disabled}
      icon={<NexoIcon name="download" />}
    >
      {pendiente ? "Generando CSV…" : label}
    </Button>
  );
}
