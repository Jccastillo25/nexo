"use client";

import { useState, useTransition } from "react";
import { StatusBadge, useToast } from "@nexo/ui";
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
const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500";

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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Cuentas bancarias</h3>
        {canCrear && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Nueva cuenta
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={crear} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Banco</span>
              <input
                required
                value={nuevo.banco}
                onChange={(e) => setNuevo((n) => ({ ...n, banco: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Número de cuenta</span>
              <input
                required
                value={nuevo.numeroCuenta}
                onChange={(e) => setNuevo((n) => ({ ...n, numeroCuenta: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Tipo</span>
              <select
                value={nuevo.tipoCuenta}
                onChange={(e) => setNuevo((n) => ({ ...n, tipoCuenta: e.target.value as "ahorro" | "corriente" }))}
                className={inputClass}
              >
                <option value="ahorro">Ahorro</option>
                <option value="corriente">Corriente</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-500">Moneda</span>
              <select
                value={nuevo.moneda}
                onChange={(e) => setNuevo((n) => ({ ...n, moneda: e.target.value as "NIO" | "USD" }))}
                className={inputClass}
              >
                <option value="NIO">Córdobas (NIO)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={nuevo.principal}
              onChange={(e) => setNuevo((n) => ({ ...n, principal: e.target.checked }))}
            />
            Marcar como cuenta principal
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {cuentas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">Sin cuentas bancarias registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-neutral-900">{c.banco}</span>
                    <span className="ml-2 text-neutral-400">
                      {c.tipoCuenta} · {c.moneda} · {c.numeroCuenta}
                    </span>
                    {c.principal && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">principal</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={c.activo ? "activa" : "inactiva"} tone={c.activo ? "positive" : "neutral"} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEditar && (
                      <div className="flex justify-end gap-3">
                        {!c.principal && c.activo && (
                          <button
                            type="button"
                            onClick={() => hacerPrincipal(c)}
                            className="text-neutral-500 hover:text-neutral-900"
                          >
                            Hacer principal
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleActivo(c)}
                          className="text-neutral-500 hover:text-neutral-900"
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
