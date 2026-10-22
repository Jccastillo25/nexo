"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, FormSection, Input, Select, Textarea, useToast } from "@nexo/ui";
import { esFechaIso } from "@/lib/planilla/periodos";
import type { MetodoConcepto } from "@/lib/planilla/tipos";
import { crearNovedad } from "./actions";

export interface ConceptoOpcion {
  id: string;
  nombre: string;
  tipo: "devengado" | "deduccion";
  metodo: MetodoConcepto;
}

const NOTA_MAX = 300;

/** Campo de la cantidad o el monto según el método del concepto (mismos topes que la RPC). */
function campoValor(metodo: MetodoConcepto | null): { label: string; step: string; max?: number; esCantidad: boolean } {
  if (metodo === "horas") return { label: "Horas", step: "0.25", max: 24, esCantidad: true };
  if (metodo === "dias") return { label: "Días", step: "0.5", max: 31, esCantidad: true };
  return { label: "Monto (C$)", step: "0.01", esCantidad: false };
}

/**
 * Formulario "Agregar novedad" (B8, movimientos.crear). La cantidad (horas o
 * días) o el monto dependen del método del concepto: se envía solo uno. Cada
 * envío lleva una `clave` (uuid) que se reusa si se reintenta el mismo envío
 * (doble clic, red caída) y se renueva al cambiar los datos o después de
 * guardar: así un reintento no crea dos novedades. Al guardar se conservan la
 * persona y la fecha para registrar la siguiente.
 */
export function NuevaNovedad({
  contratos,
  conceptos,
  hoy,
  cerrarHref,
}: {
  contratos: { id: string; etiqueta: string }[];
  conceptos: ConceptoOpcion[];
  hoy: string;
  /** URL de la lista sin `agregar` (cierra el formulario). */
  cerrarHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, startTransition] = useTransition();
  const [contratoId, setContratoId] = useState("");
  const [conceptoId, setConceptoId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<{ contrato?: string; concepto?: string; fecha?: string; valor?: string; nota?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const intento = useRef<{ clave: string; firma: string } | null>(null);

  const concepto = conceptos.find((c) => c.id === conceptoId) ?? null;
  const campo = campoValor(concepto?.metodo ?? null);
  const ingresos = conceptos.filter((c) => c.tipo === "devengado");
  const deducciones = conceptos.filter((c) => c.tipo === "deduccion");

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    const numero = Number(valor);
    if (!contratoId) nuevos.contrato = "Elige la persona.";
    if (!concepto) nuevos.concepto = "Elige el concepto.";
    if (!esFechaIso(fecha)) nuevos.fecha = "Indica la fecha de la novedad.";
    if (valor.trim() === "" || !Number.isFinite(numero) || numero <= 0) {
      nuevos.valor = `Indica ${campo.esCantidad ? `las ${campo.label.toLowerCase()}` : "el monto"} (mayor que cero).`;
    } else if (campo.max !== undefined && numero > campo.max) {
      nuevos.valor = `El máximo es ${campo.max} ${campo.label.toLowerCase()}.`;
    }
    if (nota.trim().length > NOTA_MAX) nuevos.nota = `La nota admite hasta ${NOTA_MAX} caracteres.`;
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || !concepto) return;

    // Misma clave para el mismo envío (reintento); otra si cambiaron los datos.
    const firma = JSON.stringify([contratoId, concepto.id, fecha, numero, nota.trim()]);
    if (!intento.current || intento.current.firma !== firma) {
      intento.current = { clave: crypto.randomUUID(), firma };
    }
    const clave = intento.current.clave;

    setError(null);
    startTransition(async () => {
      const r = await crearNovedad({
        contratoId,
        conceptoId: concepto.id,
        fecha,
        cantidad: campo.esCantidad ? numero : null,
        monto: campo.esCantidad ? null : numero,
        nota: nota.trim() || null,
        clave,
      });
      if (!r.ok) {
        setError(r.message);
        toast.show(r.message, "error");
        return;
      }
      intento.current = null;
      setConceptoId("");
      setValor("");
      setNota("");
      toast.show("Novedad guardada.", "success");
      router.refresh();
    });
  }

  return (
    <FormSection title="Agregar novedad" description="Ingresos y deducciones que entran en la planilla del período de la fecha.">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {error ? (
          <Alert tone="error" title="No se pudo guardar la novedad">
            {error}
          </Alert>
        ) : null}
        <fieldset disabled={pendiente} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Persona" required error={errores.contrato}>
            <Select value={contratoId} onChange={(e) => setContratoId(e.target.value)} required>
              <option value="">Elige a la persona</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Concepto" required error={errores.concepto}>
            <Select
              value={conceptoId}
              onChange={(e) => {
                setConceptoId(e.target.value);
                setValor("");
              }}
              required
            >
              <option value="">Elige el concepto</option>
              {ingresos.length > 0 ? (
                <optgroup label="Ingresos">
                  {ingresos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {deducciones.length > 0 ? (
                <optgroup label="Deducciones">
                  {deducciones.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>
          <Field label="Fecha" required error={errores.fecha} hint="Entra en la planilla cuyo período incluye esta fecha.">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Field>
          <Field label={campo.label} required error={errores.valor} hint={concepto ? undefined : "Elige primero el concepto."}>
            <Input
              type="number"
              inputMode="decimal"
              min={campo.step}
              max={campo.max}
              step={campo.step}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!concepto}
              required
            />
          </Field>
          <Field
            label="Nota"
            optional
            error={errores.nota}
            hint={`${nota.length}/${NOTA_MAX}`}
            className="sm:col-span-2"
          >
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={NOTA_MAX} rows={2} />
          </Field>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={pendiente}>
            {pendiente ? "Guardando…" : "Guardar novedad"}
          </Button>
          <Button variant="ghost" onClick={() => router.replace(cerrarHref, { scroll: false })} disabled={pendiente}>
            Cerrar
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
