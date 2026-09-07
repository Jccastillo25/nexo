"use client";

// Menu "⋯" de la fila de un empleado en el listado — Client Component
// dedicado (recibe solo props serializables: ids/booleans) porque el
// callback de accion necesita estado (ConfirmDialog, Toast), que no puede
// originarse en el Server Component del listado. Ver el comentario de
// DataTable.tsx sobre por que esto no es una prop generica de la tabla.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog, RowActionsMenu, useToast } from "@nexo/ui";
import { eliminarEmpleado } from "./actions";

export function EmpleadoRowMenu({
  empleadoId,
  nombreCompleto,
  canEditar,
  canEliminar,
}: {
  empleadoId: string;
  nombreCompleto: string;
  canEditar: boolean;
  canEliminar: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!canEditar && !canEliminar) return null;

  function confirmarEliminar() {
    startTransition(async () => {
      const res = await eliminarEmpleado(empleadoId);
      setConfirmOpen(false);
      if (!res.ok) {
        show(res.message ?? "No se pudo eliminar el empleado.", "error");
        return;
      }
      show("Empleado eliminado.", "success");
      router.refresh();
    });
  }

  return (
    <>
      <RowActionsMenu
        actions={[
          ...(canEditar
            ? [{ label: "Ver expediente", onClick: () => router.push(`/expedientes/${empleadoId}`) }]
            : []),
          ...(canEliminar
            ? [{ label: "Eliminar", destructive: true, onClick: () => setConfirmOpen(true) }]
            : []),
        ]}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar empleado"
        description={`¿Eliminar el expediente de ${nombreCompleto}? Esta acción no se puede deshacer. Si el empleado tiene algún contrato registrado, se rechazará.`}
        confirmLabel="Eliminar"
        destructive
        pending={isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
