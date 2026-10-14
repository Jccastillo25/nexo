"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog, RowActionsMenu, useToast } from "@nexo/ui";
import { eliminarRol } from "./actions";

export default function EliminarRolButton({
  rolId,
  nombre,
  enUso,
}: {
  rolId: string;
  nombre: string;
  enUso: boolean;
}) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <RowActionsMenu
        actions={[
          {
            label: enUso ? "Eliminar (en uso)" : "Eliminar",
            destructive: true,
            disabled: enUso,
            onClick: () => setOpen(true),
          },
        ]}
      />
      <ConfirmDialog
        open={open}
        title={`¿Eliminar el rol "${nombre}"?`}
        description="Esta acción no se puede deshacer. Solo se pueden eliminar roles que ningún usuario tenga asignado."
        confirmLabel="Eliminar"
        destructive
        pending={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await eliminarRol(rolId);
            setOpen(false);
            show(res.ok ? "Rol eliminado." : res.message ?? "No se pudo eliminar el rol.", res.ok ? "success" : "error");
          })
        }
      />
    </>
  );
}
