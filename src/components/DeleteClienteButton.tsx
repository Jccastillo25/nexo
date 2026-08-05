"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteCliente, type DeleteState } from "@/app/(app)/clientes/actions";

const initialState: DeleteState = { error: null };

export default function DeleteClienteButton({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    deleteCliente.bind(null, id),
    initialState
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm border border-red-700/40 px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-red-800 transition-colors hover:bg-red-700/10"
      >
        Eliminar cliente
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          className="fixed inset-0 z-20 flex items-center justify-center bg-acero/50 px-4"
        >
          <div className="w-full max-w-sm rounded-md border border-acero-medio/25 bg-concreto p-5 shadow-lg">
            <h2
              id="confirm-delete-title"
              className="font-display text-lg text-acero"
            >
              ¿Eliminar cliente?
            </h2>
            <p className="mt-2 font-mono text-sm text-acero-medio">
              Se eliminará <span className="text-acero">{nombre}</span> de
              forma permanente. Esta acción no se puede deshacer.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-sm border border-acero-medio/40 px-4 py-2 font-mono text-xs uppercase tracking-wide text-acero-medio transition-colors hover:border-acero"
              >
                Cancelar
              </button>
              <form action={formAction}>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-sm bg-red-700 px-4 py-2 font-mono text-xs uppercase tracking-wide text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
