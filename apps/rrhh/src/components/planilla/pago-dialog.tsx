"use client";

import { useState, type ReactNode } from "react";
import { ConfirmDialog, Field, Input, Select, fechaCorta } from "@nexo/ui";
import { hoyManagua } from "@/lib/fecha-managua";
import { METODO_PAGO } from "@/lib/planilla/etiquetas";
import { esFechaIso } from "@/lib/planilla/periodos";
import type { MetodoPago } from "@/lib/planilla/tipos";

export interface DatosPago {
  metodo: MetodoPago;
  /** Recortada; null si se dejó vacía. */
  referencia: string | null;
  /** "YYYY-MM-DD". */
  fecha: string;
}

export interface PagoDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  pending?: boolean;
  /** Fecha mínima "YYYY-MM-DD" (p. ej. el inicio del período). */
  fechaMin?: string;
  /** Fecha máxima "YYYY-MM-DD" (p. ej. hoy + 31). */
  fechaMax?: string;
  /** Fecha propuesta; por defecto, hoy en Managua. */
  fechaInicial?: string;
  /** Método propuesto; por defecto, cheque (D18). */
  metodoInicial?: MetodoPago;
  onConfirm: (datos: DatosPago) => void;
  onCancel: () => void;
  /** Resumen del pago (neto, personas, aviso del contador) antes de los campos. */
  children?: ReactNode;
}

const REFERENCIA_MAX = 120;

/**
 * Diálogo "Marcar como pagada" (planilla o liquidación): método, N.º de
 * cheque o referencia (opcional, hasta 120) y fecha de pago, con validación
 * en línea. Marcar como pagada no cambia los montos; la RPC vuelve a validar
 * (p. ej. rechaza la transferencia si alguien no tiene cuenta).
 */
export function PagoDialog(props: PagoDialogProps) {
  // Se monta solo mientras está abierto: cada apertura vuelve a los valores propuestos.
  if (!props.open) return null;
  return <PanelPago {...props} />;
}

function PanelPago({
  title = "Marcar como pagada",
  description,
  confirmLabel = "Marcar como pagada",
  pending = false,
  fechaMin,
  fechaMax,
  fechaInicial,
  metodoInicial = "cheque",
  onConfirm,
  onCancel,
  children,
}: PagoDialogProps) {
  const [metodo, setMetodo] = useState<MetodoPago>(metodoInicial);
  const [referencia, setReferencia] = useState("");
  const [fecha, setFecha] = useState(() => fechaInicial ?? hoyManagua());
  const [errores, setErrores] = useState<{ referencia?: string; fecha?: string }>({});

  function confirmar() {
    const nuevos: { referencia?: string; fecha?: string } = {};
    const ref = referencia.trim();
    if (ref.length > REFERENCIA_MAX) nuevos.referencia = `La referencia admite hasta ${REFERENCIA_MAX} caracteres.`;
    if (!esFechaIso(fecha)) nuevos.fecha = "Indica la fecha de pago.";
    else if (fechaMin && fecha < fechaMin) nuevos.fecha = `La fecha de pago no puede ser anterior al ${fechaCorta(fechaMin)}.`;
    else if (fechaMax && fecha > fechaMax) nuevos.fecha = `La fecha de pago no puede ser posterior al ${fechaCorta(fechaMax)}.`;
    setErrores(nuevos);
    if (nuevos.referencia || nuevos.fecha) return;
    onConfirm({ metodo, referencia: ref || null, fecha });
  }

  return (
    <ConfirmDialog
      open
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pending={pending}
      onConfirm={confirmar}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        {children}
        <Field label="Método de pago" required>
          <Select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value === "transferencia" ? "transferencia" : "cheque")}
            disabled={pending}
            required
          >
            {(Object.keys(METODO_PAGO) as MetodoPago[]).map((m) => (
              <option key={m} value={m}>
                {METODO_PAGO[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="N.º de cheque o referencia" optional error={errores.referencia}>
          <Input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={REFERENCIA_MAX}
            autoComplete="off"
            disabled={pending}
          />
        </Field>
        <Field label="Fecha de pago" required error={errores.fecha}>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            min={fechaMin}
            max={fechaMax}
            disabled={pending}
            required
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
