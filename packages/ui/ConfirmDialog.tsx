"use client";

// Dialogo de confirmacion universal — reemplaza los `confirm()` nativos del
// navegador (ej. antes de eliminar un empleado, antes de descartar cambios
// sin guardar en el editor de jornada). Controlado por el padre (`open`),
// sin estado propio de visibilidad.
//
// Accesibilidad (2026-10-20, embudo comercial del CRM): cierra con Escape,
// pone el foco inicial en el primer control del contenido (o en "Cancelar"),
// atrapa Tab/Shift+Tab dentro del panel y, al cerrarse, devuelve el foco al
// elemento que lo abrio. `children` (opcional) permite meter un campo dentro
// del dialogo (motivo, comentario); la API anterior no cambia.
//
// v2 (2026-10-20): radio de 16px y botones del kit (Button): mismo azul y
// mismo foco que el resto; "Confirmar" muestra spinner mientras `pending`.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo rojo para acciones irreversibles (ej. eliminar). */
  destructive?: boolean;
  /** Deshabilita los botones mientras la accion esta en curso. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Contenido propio entre el mensaje y los botones (ej. un campo de motivo). */
  children?: ReactNode;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  // Se monta solo mientras esta abierto: el montaje captura el foco previo y
  // el desmontaje lo devuelve.
  return <DialogPanel {...props} />;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogPanel({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Ultimos valores para el listener de teclado sin re-suscribirlo.
  const latest = useRef({ onCancel, pending });
  useEffect(() => {
    latest.current = { onCancel, pending };
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? cancelRef.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!latest.current.pending) {
          e.preventDefault();
          latest.current.onCancel();
        }
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || !panelRef.current.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (active === lastItem || !panelRef.current.contains(active))) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-neutral-950/40 px-4"
    >
      <div
        ref={panelRef}
        className={`max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${
          children ? "max-w-md" : "max-w-sm"
        }`}
      >
        <h2 id={titleId} className="text-base font-semibold text-neutral-900">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-2 text-sm text-neutral-500">
            {description}
          </p>
        )}
        {children ? (
          <div ref={contentRef} className="mt-4">
            {children}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
