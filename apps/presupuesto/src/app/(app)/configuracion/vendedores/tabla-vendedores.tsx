"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, DataTable, Input, Select, StatusBadge, fechaCorta, useToast, type DataTableColumn } from "@nexo/ui";
import type { UsuarioVinculable, Vendedor } from "@/lib/metas/tipos";
import { guardarVendedor } from "./actions";

/** Lo que el usuario está editando en una fila. */
interface Borrador {
  nombre: string;
  userId: string;
  activo: boolean;
}

/**
 * Versión guardada de una fila. Los borradores se guardan con esta clave: al
 * refrescar después de guardar, la versión cambia y la fila vuelve sola a los
 * valores de la base (lo que antes hacía la `key` de cada fila).
 */
const version = (v: Vendedor) => `${v.id}|${v.nombre}|${v.user_id ?? ""}|${v.activo}`;
const desdeBase = (v: Vendedor): Borrador => ({ nombre: v.nombre, userId: v.user_id ?? "", activo: v.activo });

/**
 * Vendedores con su nombre, usuario de Nexo y estado. Cada fila se guarda por
 * separado (presupuesto_guardar_vendedor). DataTable del kit; el estado de las
 * filas vive aquí porque cada celda se dibuja por separado.
 */
export function TablaVendedores({ vendedores, usuarios }: { vendedores: Vendedor[]; usuarios: UsuarioVinculable[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [, startTransition] = useTransition();
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmar, setConfirmar] = useState<{ v: Vendedor; texto: string } | null>(null);

  const codigoPorId = new Map(vendedores.map((v) => [v.id, v.codigo]));
  const valores = (v: Vendedor): Borrador => borradores[version(v)] ?? desdeBase(v);
  const cambiar = (v: Vendedor, parcial: Partial<Borrador>) =>
    setBorradores((prev) => ({ ...prev, [version(v)]: { ...(prev[version(v)] ?? desdeBase(v)), ...parcial } }));
  const ponerError = (id: string, mensaje: string | null) =>
    setErrores((prev) => {
      const siguiente = { ...prev };
      if (mensaje) siguiente[id] = mensaje;
      else delete siguiente[id];
      return siguiente;
    });
  const marcarGuardando = (id: string, si: boolean) =>
    setGuardando((prev) => {
      const s = new Set(prev);
      if (si) s.add(id);
      else s.delete(id);
      return s;
    });

  function pedirGuardar(v: Vendedor) {
    const { nombre, userId, activo } = valores(v);
    const limpio = nombre.trim();
    if (limpio.length < 1 || limpio.length > 120) {
      ponerError(v.id, "El nombre debe tener entre 1 y 120 caracteres.");
      return;
    }
    ponerError(v.id, null);
    const desvincula = v.user_id !== null && !userId;
    const desactiva = v.activo && !activo;
    if (desvincula || desactiva) {
      setConfirmar({
        v,
        texto: [
          desvincula ? `${v.nombre} deja de ver su avance en Mi avance hasta que lo vuelvas a vincular.` : null,
          desactiva ? "Un vendedor inactivo no recibe meta sugerida; sus facturas se conservan." : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      return;
    }
    void guardar(v);
  }

  async function guardar(v: Vendedor) {
    const { nombre, userId, activo } = valores(v);
    marcarGuardando(v.id, true);
    try {
      // Siempre los tres valores actuales de la fila (H1): la RPC escribe user_id tal cual.
      const res = await guardarVendedor({ vendedorId: v.id, nombre: nombre.trim(), userId: userId || null, activo });
      if (!res.ok) {
        ponerError(v.id, res.message ?? "No se pudo guardar el vendedor.");
        return;
      }
      show(`Vendedor ${v.codigo} guardado.`, "success");
      startTransition(() => router.refresh());
    } catch {
      ponerError(v.id, "No se pudo guardar el vendedor. Revisa tu conexión e intenta de nuevo.");
    } finally {
      marcarGuardando(v.id, false);
      setConfirmar((actual) => (actual?.v.id === v.id ? null : actual));
    }
  }

  const columnas: DataTableColumn<Vendedor>[] = [
    {
      key: "codigo",
      header: "Código",
      className: "align-top whitespace-nowrap",
      render: (v) => <span className="font-mono text-xs text-neutral-700">{v.codigo}</span>,
    },
    {
      key: "nombre",
      header: "Nombre",
      className: "align-top",
      render: (v) => {
        const { nombre } = valores(v);
        const limpio = nombre.trim();
        const valido = limpio.length >= 1 && limpio.length <= 120;
        const error = errores[v.id];
        return (
          <>
            <label htmlFor={`v-nombre-${v.id}`} className="sr-only">
              Nombre del vendedor {v.codigo}
            </label>
            <div className="w-48">
              <Input
                id={`v-nombre-${v.id}`}
                type="text"
                value={nombre}
                maxLength={120}
                onChange={(e) => cambiar(v, { nombre: e.target.value })}
                disabled={guardando.has(v.id)}
                invalid={!valido || !!error}
                aria-describedby={error ? `v-error-${v.id}` : undefined}
              />
            </div>
            {error ? (
              <p id={`v-error-${v.id}`} role="alert" className="mt-1 max-w-[14rem] text-xs text-red-700">
                {error}
              </p>
            ) : null}
          </>
        );
      },
    },
    {
      key: "usuario",
      header: "Usuario de Nexo",
      className: "align-top",
      render: (v) => (
        <>
          <label htmlFor={`v-usuario-${v.id}`} className="sr-only">
            Usuario de Nexo de {v.codigo}
          </label>
          <div className="w-56 max-w-full">
            <Select
              id={`v-usuario-${v.id}`}
              value={valores(v).userId}
              onChange={(e) => cambiar(v, { userId: e.target.value })}
              disabled={guardando.has(v.id)}
            >
              <option value="">Sin vincular</option>
              {v.user_id && !usuarios.some((u) => u.user_id === v.user_id) ? (
                // Usuario vinculado que ya no está activo en la empresa: se muestra para poder desvincularlo.
                <option value={v.user_id}>{v.usuario_nombre ?? "Usuario"} (inactivo)</option>
              ) : null}
              {usuarios.map((u) => {
                const otro = u.vendedor_id && u.vendedor_id !== v.id ? codigoPorId.get(u.vendedor_id) ?? "otro vendedor" : null;
                return (
                  <option key={u.user_id} value={u.user_id} disabled={!!otro}>
                    {u.nombre}
                    {u.nombre !== u.email ? ` (${u.email})` : ""}
                    {otro ? ` (vinculado a ${otro})` : ""}
                  </option>
                );
              })}
            </Select>
          </div>
        </>
      ),
    },
    {
      key: "activo",
      header: "Activo",
      className: "align-top",
      render: (v) => {
        const { activo } = valores(v);
        return (
          <>
            <label className="flex items-center gap-2 py-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                role="switch"
                checked={activo}
                onChange={(e) => cambiar(v, { activo: e.target.checked })}
                disabled={guardando.has(v.id)}
                aria-checked={activo}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <span className="sr-only">Vendedor {v.codigo}</span> Activo
            </label>
            {!v.activo ? <StatusBadge label="Inactivo" tone="neutral" /> : null}
          </>
        );
      },
    },
    {
      key: "ultimaVenta",
      header: "Última venta",
      className: "hidden align-top whitespace-nowrap tabular-nums text-neutral-600 md:table-cell",
      render: (v) => (v.ultima_venta ? fechaCorta(v.ultima_venta) : "Sin ventas"),
    },
    {
      key: "acciones",
      header: <span className="sr-only">Acciones</span>,
      className: "align-top",
      render: (v) => {
        const b = valores(v);
        const cambio = b.nombre.trim() !== v.nombre || (b.userId || null) !== v.user_id || b.activo !== v.activo;
        const ocupado = guardando.has(v.id);
        return (
          <Button variant="secondary" onClick={() => pedirGuardar(v)} disabled={!cambio} loading={ocupado}>
            {ocupado ? "Guardando…" : "Guardar"}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <DataTable columns={columnas} rows={vendedores} rowKey={(v) => v.id} caption="Vendedores" />
      <ConfirmDialog
        open={confirmar !== null}
        title={`Guardar cambios de ${confirmar?.v.codigo ?? ""}`}
        description={confirmar?.texto}
        confirmLabel="Guardar"
        destructive
        pending={confirmar ? guardando.has(confirmar.v.id) : false}
        onConfirm={() => {
          if (confirmar) void guardar(confirmar.v);
        }}
        onCancel={() => setConfirmar(null)}
      />
    </>
  );
}
