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
        className="rounded-md border border-red-200 px-4 py-2.5 text-xs uppercase tracking-wide text-red-700 transition-colors hover:bg-red-50"
      >
        Eliminar cliente
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          className="fixed inset-0 z-20 flex items-center justify-center bg-neutral-900/50 px-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-lg">
            <h2
              id="confirm-delete-title"
              className="text-lg font-semibold text-neutral-900"
            >
              ¿Eliminar cliente?
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Se eliminará <span className="text-neutral-900">{nombre}</span> de
              forma permanente. Esta acción no se puede deshacer.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-md border border-neutral-300 px-4 py-2 text-xs uppercase tracking-wide text-neutral-600 transition-colors hover:border-neutral-400"
              >
                Cancelar
              </button>
              <form action={formAction}>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-xs uppercase tracking-wide text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
