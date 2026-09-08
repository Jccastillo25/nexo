"use client";

// Columna de acciones de la fila de un empleado en el listado — Client
// Component dedicado (recibe solo props serializables: ids/booleans)
// porque el callback de "Eliminar" necesita estado (ConfirmDialog, Toast),
// que no puede originarse en el Server Component del listado. Ver el
// comentario de DataTable.tsx sobre por que esto no es una prop generica
// de la tabla.
//
// Regla obligatoria 2026-09-08: acciones visibles como iconos (👁 ✎ 🗑),
// no ocultas en un menu "⋯" — reemplaza el RowActionsMenu anterior.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog, RowActionIcons, useToast } from "@nexo/ui";
import { eliminarEmpleado } from "./actions";

export function EmpleadoRowMenu({
  empleadoId,
  nombreCompleto,
  canVer,
  canEditar,
  canEliminar,
  /** true si el empleado tiene al menos un contrato (cualquier estado) —
   * calculado en el listado (page.tsx) a partir de rrhh.contratos.
   * Cuando es `null` no se pudo determinar (ej. usuario sin
   * `contratos.ver`) — en ese caso la papelera queda habilitada y la
   * validacion real la sigue haciendo el backend
   * (rrhh.fn_eliminar_empleado), nunca solo la UI. */
  tieneContrato,
}: {
  empleadoId: string;
  nombreCompleto: string;
  canVer: boolean;
  canEditar: boolean;
  canEliminar: boolean;
  tieneContrato: boolean | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!canVer && !canEditar && !canEliminar) return null;

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

  const eliminarDeshabilitado = !canEliminar || tieneContrato === true;

  return (
    <>
      <RowActionIcons
        actions={[
          ...(canVer
            ? [
                {
                  key: "ver",
                  icon: "eye" as const,
                  label: "Visualizar",
                  href: `/expedientes/${empleadoId}`,
                },
              ]
            : []),
          ...(canEditar
            ? [
                {
                  key: "editar",
                  icon: "pencil" as const,
                  label: "Editar",
                  href: `/expedientes/${empleadoId}`,
                },
              ]
            : []),
          ...(canEliminar
            ? [
                {
                  key: "eliminar",
                  icon: "trash" as const,
                  label: "Eliminar",
                  destructive: true,
                  disabled: eliminarDeshabilitado,
                  disabledReason:
                    tieneContrato === true
                      ? "No se puede eliminar: tiene historial contractual."
                      : "Eliminar",
                  onClick: () => setConfirmOpen(true),
                },
              ]
            : []),
        ]}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar empleado"
        description={`¿Eliminar el expediente de ${nombreCompleto}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        pending={isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
