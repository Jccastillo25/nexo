"use client";

import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, Field, Textarea } from "@nexo/ui";
import { MOTIVO_MAX, MOTIVO_MIN, validarMotivo } from "@/lib/planilla/estados";

export interface MotivoDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Estilo rojo para acciones irreversibles (anular). */
  destructive?: boolean;
  /** Acción en curso: botones y campo deshabilitados, spinner en confirmar. */
  pending?: boolean;
  /** Recibe el motivo ya recortado y válido. */
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  /** Etiqueta del campo (por defecto "Motivo"). */
  label?: string;
  /** Ayuda bajo el campo, antes del contador. */
  hint?: string;
  minimo?: number;
  maximo?: number;
  /** Campos o resumen extra, antes del motivo (p. ej. la fecha de fin de un embargo). */
  children?: ReactNode;
}

/**
 * ConfirmDialog con un motivo obligatorio (anular, rechazar, descartar,
 * cancelar…): 5 a 500 caracteres por defecto, contador "n/500" y error en
 * línea junto al campo. El motivo se borra cada vez que se abre. La RPC
 * vuelve a validar el motivo.
 */
export function MotivoDialog(props: MotivoDialogProps) {
  // Se monta solo mientras está abierto: cada apertura empieza en blanco.
  if (!props.open) return null;
  return <PanelMotivo {...props} />;
}

function PanelMotivo({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
  label = "Motivo",
  hint,
  minimo = MOTIVO_MIN,
  maximo = MOTIVO_MAX,
  children,
}: MotivoDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  function confirmar() {
    const problema = validarMotivo(motivo, minimo, maximo);
    if (problema) {
      setError(problema);
      campo.current?.focus();
      return;
    }
    onConfirm(motivo.trim());
  }

  const contador = `${motivo.length}/${maximo}`;

  return (
    <ConfirmDialog
      open
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={destructive}
      pending={pending}
      onConfirm={confirmar}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        {children}
        <Field label={label} required error={error ?? undefined} hint={hint ? `${hint} · ${contador}` : contador}>
          <Textarea
            ref={campo}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError(null);
            }}
            maxLength={maximo}
            rows={3}
            disabled={pending}
            required
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
