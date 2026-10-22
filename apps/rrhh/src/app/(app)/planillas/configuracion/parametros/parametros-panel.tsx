"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
  fechaCorta,
  useToast,
} from "@nexo/ui";
import { sumarDias } from "@/lib/fecha-managua";
import { ESTADO_CERTEZA, estadoVisual } from "@/lib/planilla/estados";
import { CERTEZA } from "@/lib/planilla/etiquetas";
import { aFraccion, aPorcentaje, valorParametro } from "@/lib/planilla/formato";
import { MESES, esFechaIso, nombreMes } from "@/lib/planilla/periodos";
import type { Certeza, UnidadParametro } from "@/lib/planilla/tipos";
import { AlertaError } from "../_compartido/alerta-error";
import { nuevaVigenciaParametro } from "./actions";

/** Una vigencia de un parámetro (lo que la pantalla necesita, sin ids de usuario). */
export interface VigenciaParametro {
  id: string;
  valor: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  certeza: Certeza;
  fuente: string | null;
}

/** Un parámetro con su vigencia abierta y, si esa empieza después de hoy, la que rige hoy. */
export interface ParametroVista {
  codigo: string;
  etiqueta: string;
  unidad: UnidadParametro;
  /** Vigencia abierta (vigente_hasta nulo): la última cargada. */
  abierta: VigenciaParametro;
  /** Vigencia que rige hoy, si no es la abierta (la abierta está programada). */
  rigeHoy: VigenciaParametro | null;
}

const RADIO =
  "mt-0.5 size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const PORCENTAJE = /^\d{1,3}(\.\d{1,2})?$/;
const MONTO = /^\d{1,8}(\.\d{1,2})?$/;
const NUMERO = /^\d{1,8}(\.\d{1,4})?$/;

/**
 * Tabla de parámetros de ley vigentes (A6) con la acción "Nueva vigencia"
 * (solo con parametros.editar; la acción y la RPC vuelven a validarlo).
 */
export function ParametrosPanel({
  parametros,
  hoy,
  puedeEditar,
}: {
  parametros: ParametroVista[];
  hoy: string;
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<ParametroVista | null>(null);

  return (
    <>
      <DataTable
        rows={parametros}
        rowKey={(p) => p.codigo}
        caption="Parámetros de ley vigentes"
        empty={
          <EmptyState
            bare
            title="Todavía no hay parámetros de ley"
            description="Los parámetros se cargan con la puesta en marcha de Planilla. Pide ayuda a quien administra Nexo."
          />
        }
        columns={[
          {
            key: "parametro",
            header: "Parámetro",
            render: (p) => (
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-neutral-900">{p.etiqueta}</span>
                <span className="text-xs text-neutral-500">{p.codigo}</span>
              </span>
            ),
          },
          {
            key: "valor",
            header: "Valor",
            numeric: true,
            render: (p) => (
              <span className="flex flex-col items-end">
                <span>{valorParametro(p.abierta.valor, p.unidad, p.codigo)}</span>
                {p.rigeHoy ? (
                  <span className="text-xs text-neutral-500">
                    Hoy: {valorParametro(p.rigeHoy.valor, p.unidad, p.codigo)}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "desde",
            header: "Vigente desde",
            render: (p) => (
              <span className="flex flex-col items-start gap-1">
                <span className="tabular-nums">{fechaCorta(p.abierta.vigente_desde)}</span>
                {p.abierta.vigente_desde > hoy ? <StatusBadge label="Programado" tone="info" /> : null}
              </span>
            ),
          },
          {
            key: "certeza",
            header: "Certeza",
            render: (p) => {
              const c = estadoVisual(ESTADO_CERTEZA, p.abierta.certeza);
              return <StatusBadge label={c.label} tone={c.tone} />;
            },
          },
          {
            key: "fuente",
            header: "Fuente",
            width: "16rem",
            render: (p) => <span className="break-words">{p.abierta.fuente ?? "—"}</span>,
          },
          ...(puedeEditar
            ? [
                {
                  key: "accion",
                  header: "Acción",
                  align: "right" as const,
                  render: (p: ParametroVista) => (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditando(p)}
                      aria-label={`Nueva vigencia de ${p.etiqueta}`}
                    >
                      Nueva vigencia
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {editando && puedeEditar ? (
        <DialogoVigencia key={editando.codigo} parametro={editando} onCerrar={() => setEditando(null)} />
      ) : null}
    </>
  );
}

function valorInicial(p: ParametroVista): string {
  if (p.unidad === "porcentaje") {
    const pct = aPorcentaje(p.abierta.valor);
    return pct === null ? "" : String(pct);
  }
  return String(p.abierta.valor);
}

/** Valida el valor escrito y lo pasa a la unidad de la base (fracción si es %). */
function leerValor(p: ParametroVista, texto: string): { valor: number } | { error: string } {
  const t = texto.trim();
  if (p.codigo === "aguinaldo_mes_inicio") {
    const mes = Number(t);
    return Number.isInteger(mes) && mes >= 1 && mes <= 12 ? { valor: mes } : { error: "Elige el mes." };
  }
  if (p.unidad === "porcentaje") {
    if (!PORCENTAJE.test(t) || Number(t) > 100) return { error: "Indica un porcentaje de 0 a 100, con hasta 2 decimales." };
    return { valor: aFraccion(Number(t)) };
  }
  if (p.unidad === "monto") {
    if (!MONTO.test(t)) return { error: "Indica un monto en C$ igual o mayor que 0, con hasta 2 decimales." };
    return { valor: Number(t) };
  }
  if (!NUMERO.test(t) || Number(t) <= 0) return { error: "Indica un número mayor que 0, con hasta 4 decimales." };
  return { valor: Number(t) };
}

interface Errores {
  valor?: string;
  vigenteDesde?: string;
  fuente?: string;
}

function DialogoVigencia({ parametro, onCerrar }: { parametro: ParametroVista; onCerrar: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [valor, setValor] = useState(() => valorInicial(parametro));
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [certeza, setCerteza] = useState<Certeza>(parametro.abierta.certeza);
  const [fuente, setFuente] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const minimo = sumarDias(parametro.abierta.vigente_desde, 1);
  const fechaValida = esFechaIso(vigenteDesde);

  function guardar() {
    const nuevos: Errores = {};
    const leido = leerValor(parametro, valor);
    if ("error" in leido) nuevos.valor = leido.error;
    if (!fechaValida) nuevos.vigenteDesde = "Indica desde qué fecha rige el nuevo valor.";
    else if (vigenteDesde < minimo) {
      nuevos.vigenteDesde = `La nueva vigencia debe empezar después del ${fechaCorta(parametro.abierta.vigente_desde)}.`;
    }
    const f = fuente.trim();
    if (f.length < 3 || f.length > 200) nuevos.fuente = "Indica la fuente (3 a 200 caracteres).";
    setErrores(nuevos);
    if ("error" in leido || nuevos.vigenteDesde || nuevos.fuente) return;

    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await nuevaVigenciaParametro({
        codigo: parametro.codigo,
        valor: leido.valor,
        vigenteDesde,
        certeza,
        fuente: f,
      });
      if (!r.ok) {
        // El diálogo sigue abierto con el mensaje de la RPC (un solo canal de error).
        setError(r.message);
        return;
      }
      toast.show(`${parametro.etiqueta}: el nuevo valor rige desde ${fechaCorta(vigenteDesde)}.`, "success");
      onCerrar();
      router.refresh();
    });
  }

  const etiquetaValor =
    parametro.codigo === "aguinaldo_mes_inicio"
      ? "Mes"
      : parametro.unidad === "porcentaje"
        ? "Valor (%)"
        : parametro.unidad === "monto"
          ? "Valor (C$)"
          : "Valor";

  return (
    <ConfirmDialog
      open
      title={`Nueva vigencia: ${parametro.etiqueta}`}
      description="Las planillas ya aprobadas conservan el valor con que se calcularon."
      confirmLabel="Guardar nueva vigencia"
      pending={pendiente}
      onConfirm={guardar}
      onCancel={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-700">
          Valor actual: {valorParametro(parametro.abierta.valor, parametro.unidad, parametro.codigo)} desde el{" "}
          {fechaCorta(parametro.abierta.vigente_desde)}.
        </p>
        {error ? <AlertaError title="No se pudo guardar">{error}</AlertaError> : null}
        <Field label={etiquetaValor} required error={errores.valor}>
          {parametro.codigo === "aguinaldo_mes_inicio" ? (
            <Select value={valor} onChange={(e) => setValor(e.target.value)} disabled={pendiente} required>
              {MESES.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {nombreMes(i + 1, true)}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min={parametro.unidad === "numero" ? undefined : 0}
              max={parametro.unidad === "porcentaje" ? 100 : undefined}
              step={parametro.unidad === "numero" ? "any" : 0.01}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={pendiente}
              required
            />
          )}
        </Field>
        <Field
          label="Vigente desde"
          required
          error={errores.vigenteDesde}
          hint={
            fechaValida && vigenteDesde >= minimo
              ? `La vigencia actual se cierra el ${fechaCorta(sumarDias(vigenteDesde, -1))}.`
              : `Después del ${fechaCorta(parametro.abierta.vigente_desde)}.`
          }
        >
          <Input
            type="date"
            min={minimo}
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            disabled={pendiente}
            required
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
            Certeza
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          </legend>
          {(Object.keys(CERTEZA) as Certeza[]).map((c) => (
            <label key={c} className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name={`${id}-certeza`}
                className={RADIO}
                checked={certeza === c}
                onChange={() => setCerteza(c)}
                disabled={pendiente}
              />
              <span>
                {CERTEZA[c].label}
                <span className="block text-xs text-neutral-500">{CERTEZA[c].descripcion}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field
          label="Fuente"
          required
          error={errores.fuente}
          hint="Ejemplo: Factura del INSS de septiembre de 2026."
        >
          <Input
            value={fuente}
            onChange={(e) => setFuente(e.target.value)}
            maxLength={200}
            autoComplete="off"
            disabled={pendiente}
            required
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
