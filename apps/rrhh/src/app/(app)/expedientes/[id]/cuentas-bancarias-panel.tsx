"use client";

import { useState, useTransition } from "react";
import { Alert, Button, DataTable, EmptyState, Field, Input, Select, StatusBadge, useToast } from "@nexo/ui";
import { crearCuentaBancaria, editarCuentaBancaria, type CuentaBancariaInput } from "./cuentas-bancarias-actions";

export interface CuentaBancariaRow {
  id: string;
  banco: string;
  tipoCuenta: "ahorro" | "corriente";
  moneda: "NIO" | "USD";
  numeroCuenta: string;
  principal: boolean;
  activo: boolean;
}

const EMPTY: CuentaBancariaInput = { banco: "", tipoCuenta: "ahorro", moneda: "NIO", numeroCuenta: "", principal: false };

const TIPO_LABEL: Record<CuentaBancariaRow["tipoCuenta"], string> = { ahorro: "Ahorro", corriente: "Corriente" };
const MONEDA_LABEL: Record<CuentaBancariaRow["moneda"], string> = { NIO: "Córdobas", USD: "Dólares" };

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): pestaña "Cuentas bancarias" --
 * dato sensible, solo visible/editable con rrhh.expedientes.
 * cuentas_bancarias.* (admin).
 */
export default function CuentasBancariasPanel({
  empleadoId,
  cuentas,
  canCrear,
  canEditar,
}: {
  empleadoId: string;
  cuentas: CuentaBancariaRow[];
  canCrear: boolean;
  canEditar: boolean;
}) {
  const { show } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<CuentaBancariaInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearCuentaBancaria(empleadoId, nuevo);
      if (!res.ok) {
        setError(res.message ?? "No se pudo crear la cuenta.");
        show(res.message ?? "No se pudo crear la cuenta.", "error");
        return;
      }
      setNuevo(EMPTY);
      setShowForm(false);
      show("Cuenta agregada.", "success");
    });
  }

  function toggleActivo(c: CuentaBancariaRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarCuentaBancaria(empleadoId, c.id, {
        banco: c.banco,
        tipoCuenta: c.tipoCuenta,
        moneda: c.moneda,
        numeroCuenta: c.numeroCuenta,
        principal: c.principal,
        activo: !c.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo actualizar la cuenta.");
        show(res.message ?? "No se pudo actualizar la cuenta.", "error");
      }
    });
  }

  function hacerPrincipal(c: CuentaBancariaRow) {
    setError(null);
    startTransition(async () => {
      const res = await editarCuentaBancaria(empleadoId, c.id, {
        banco: c.banco,
        tipoCuenta: c.tipoCuenta,
        moneda: c.moneda,
        numeroCuenta: c.numeroCuenta,
        principal: true,
        activo: c.activo,
      });
      if (!res.ok) {
        setError(res.message ?? "No se pudo marcar como principal.");
        show(res.message ?? "No se pudo marcar como principal.", "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Cuentas bancarias</h3>
        {canCrear && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Agregar cuenta
          </Button>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {showForm ? (
        <form
          onSubmit={crear}
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Banco" required>
              <Input
                required
                value={nuevo.banco}
                onChange={(e) => setNuevo((n) => ({ ...n, banco: e.target.value }))}
              />
            </Field>
            <Field label="Número de cuenta" required>
              <Input
                required
                inputMode="numeric"
                autoComplete="off"
                value={nuevo.numeroCuenta}
                onChange={(e) => setNuevo((n) => ({ ...n, numeroCuenta: e.target.value }))}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={nuevo.tipoCuenta}
                onChange={(e) => setNuevo((n) => ({ ...n, tipoCuenta: e.target.value as "ahorro" | "corriente" }))}
              >
                <option value="ahorro">Ahorro</option>
                <option value="corriente">Corriente</option>
              </Select>
            </Field>
            <Field label="Moneda">
              <Select
                value={nuevo.moneda}
                onChange={(e) => setNuevo((n) => ({ ...n, moneda: e.target.value as "NIO" | "USD" }))}
              >
                <option value="NIO">Córdobas (NIO)</option>
                <option value="USD">Dólares (USD)</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={nuevo.principal}
              onChange={(e) => setNuevo((n) => ({ ...n, principal: e.target.checked }))}
              className="size-4 rounded border-neutral-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            Marcar como cuenta principal
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Agregar cuenta
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={cuentas}
        rowKey={(c) => c.id}
        density="compact"
        caption="Cuentas bancarias del empleado"
        empty={<EmptyState bare title="Sin cuentas bancarias registradas" />}
        columns={[
          {
            key: "banco",
            header: "Banco",
            render: (c) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-900">{c.banco}</span>
                {c.principal ? <StatusBadge label="Principal" tone="info" dot={false} /> : null}
              </span>
            ),
          },
          {
            key: "cuenta",
            header: "Cuenta",
            render: (c) => (
              <span className="text-neutral-600">
                {TIPO_LABEL[c.tipoCuenta]} · {MONEDA_LABEL[c.moneda]} ·{" "}
                <span className="tabular-nums">{c.numeroCuenta}</span>
              </span>
            ),
          },
          {
            key: "estado",
            header: "Estado",
            render: (c) => (
              <StatusBadge label={c.activo ? "Activa" : "Inactiva"} tone={c.activo ? "positive" : "neutral"} />
            ),
          },
          ...(canEditar
            ? [
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right" as const,
                  render: (c: CuentaBancariaRow) => (
                    <div className="flex justify-end gap-1">
                      {!c.principal && c.activo ? (
                        <Button variant="ghost" size="sm" disabled={isPending} onClick={() => hacerPrincipal(c)}>
                          Hacer principal
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleActivo(c)}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
