"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ConfirmDialog, RowActionIcons, useToast } from "@nexo/ui";
import { anularNovedad } from "./actions";

// ---------------------------------------------------------------- error persistente

interface ErrorAnular {
  descripcion: string;
  mensaje: string;
}

interface EstadoErrorAnular {
  error: ErrorAnular | null;
  setError: (e: ErrorAnular | null) => void;
}

const ErrorAnularContexto = createContext<EstadoErrorAnular | null>(null);

/**
 * Envuelve la tabla de novedades para que el error de "Anular novedad" de
 * cualquier fila quede en un aviso persistente arriba de la tabla
 * (ErrorAnularNovedad), además del toast. Los Server Components de adentro
 * siguen siendo de servidor.
 */
export function AnularNovedadProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorAnular | null>(null);
  return <ErrorAnularContexto.Provider value={{ error, setError }}>{children}</ErrorAnularContexto.Provider>;
}

/** Aviso del último error al anular una novedad (hasta cerrarlo o hasta la siguiente anulación). */
export function ErrorAnularNovedad() {
  const ctx = useContext(ErrorAnularContexto);
  if (!ctx?.error) return null;
  const { error, setError } = ctx;
  return (
    <Alert
      tone="error"
      title="No se pudo anular la novedad"
      action={
        <Button size="sm" variant="secondary" onClick={() => setError(null)}>
          Cerrar aviso
        </Button>
      }
    >
      <p>{error.mensaje}</p>
      <p className="mt-1 text-xs">Novedad: {error.descripcion}</p>
    </Alert>
  );
}

// ---------------------------------------------------------------- acción de la fila

/**
 * Acción "Anular novedad" de una fila (movimientos.eliminar). La página solo
 * la monta cuando se puede anular (no anulada, origen manual, Excel o
 * Asistencia, y fuera de una planilla aprobada o pagada); la RPC lo vuelve a
 * validar. Si falla, el error queda arriba de la tabla (con
 * AnularNovedadProvider) o, sin él, debajo del botón de la fila.
 */
export function AnularNovedad({ id, descripcion }: { id: string; descripcion: string }) {
  const router = useRouter();
  const toast = useToast();
  const compartido = useContext(ErrorAnularContexto);
  const [abierto, setAbierto] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function mostrarError(mensaje: string | null) {
    if (compartido) compartido.setError(mensaje ? { descripcion, mensaje } : null);
    else setErrorLocal(mensaje);
  }

  function confirmar() {
    mostrarError(null);
    startTransition(async () => {
      const r = await anularNovedad(id);
      setAbierto(false);
      if (!r.ok) {
        mostrarError(r.message);
        toast.show(r.message, "error");
        return;
      }
      toast.show("Novedad anulada.", "success");
      router.refresh();
    });
  }

  return (
    <>
      <RowActionIcons
        actions={[
          {
            key: "anular",
            icon: "trash",
            label: `Anular ${descripcion}`,
            onClick: () => setAbierto(true),
            destructive: true,
            disabled: pendiente,
          },
        ]}
      />
      {errorLocal ? (
        <p role="alert" className="mt-1 max-w-xs text-right text-xs text-red-700">
          {errorLocal}
        </p>
      ) : null}
      <ConfirmDialog
        open={abierto}
        title="Anular novedad"
        description={`¿Anular ${descripcion}? Si ya entró en una planilla calculada, vuelve a calcularla.`}
        confirmLabel="Anular novedad"
        destructive
        pending={pendiente}
        onCancel={() => setAbierto(false)}
        onConfirm={confirmar}
      />
    </>
  );
}
