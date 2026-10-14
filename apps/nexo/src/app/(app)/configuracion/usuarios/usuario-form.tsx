"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormSection, useToast } from "@nexo/ui";
import type { EmpleadoBusqueda } from "@/lib/supabase/database.types";
import { buscarEmpleados, crearUsuario, editarUsuario } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

export interface UsuarioFormProps {
  roles: { id: string; nombre: string }[];
  /** null = el administrador no puede ver sucursales: no se muestra la sección. */
  sucursales: { id: string; nombre: string }[] | null;
  sucursalesAsignadas: string[];
  /** null = alta nueva. */
  usuario: {
    userId: string;
    email: string;
    nombreCompleto: string;
    telefono: string;
    cargo: string;
    rolId: string | null;
    esOwner: boolean;
    esUnoMismo: boolean;
    empleado: { id: string; nombre: string } | null;
  } | null;
}

function EmpleadoPicker({
  value,
  onChange,
}: {
  value: { id: string; nombre: string } | null;
  onChange: (v: { id: string; nombre: string } | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<EmpleadoBusqueda[] | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function buscar() {
    startTransition(async () => {
      const res = await buscarEmpleados(texto);
      setMensaje(res.ok ? null : res.message ?? "No se pudo buscar.");
      setResultados(res.empleados);
    });
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
        <span className="text-neutral-800">{value.nombre}</span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-red-600 hover:text-red-700">
          Quitar vínculo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Nombre, apellido o cédula"
          aria-label="Buscar empleado de RRHH"
          className={inputClass}
        />
        <button
          type="button"
          onClick={buscar}
          disabled={isPending}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          {isPending ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {mensaje && <p className="text-xs text-red-600">{mensaje}</p>}
      {resultados && resultados.length === 0 && !mensaje && (
        <p className="text-xs text-neutral-400">Sin resultados.</p>
      )}
      {resultados && resultados.length > 0 && (
        <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
          {resultados.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {e.nombre_completo}
                {e.documento_identidad && <span className="ml-2 text-xs text-neutral-400">{e.documento_identidad}</span>}
              </span>
              {e.vinculado_a ? (
                <span className="text-xs text-neutral-400">Ya vinculado</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange({ id: e.id, nombre: e.nombre_completo })}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Vincular
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Alta / edición de usuario (decisiones 2026-10-14): un solo rol por
 * usuario, contraseña temporal puesta por el administrador, vínculo
 * opcional con un empleado de RRHH. El correo no se edita después del alta.
 */
export default function UsuarioForm({ roles, sucursales, sucursalesAsignadas, usuario }: UsuarioFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(usuario?.nombreCompleto ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [cargo, setCargo] = useState(usuario?.cargo ?? "");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState(usuario?.rolId ?? "");
  const [empleado, setEmpleado] = useState(usuario?.empleado ?? null);
  const [sucursalIds, setSucursalIds] = useState<Set<string>>(() => new Set(sucursalesAsignadas));
  const [error, setError] = useState<string | null>(null);

  const rolBloqueado = usuario?.esOwner || usuario?.esUnoMismo;

  function guardar() {
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribí el nombre completo.");
    if (!usuario) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Escribí un correo válido.");
      if (password.length < 8) return setError("La contraseña temporal debe tener al menos 8 caracteres.");
    }
    if (!usuario?.esOwner && !rolId) return setError("Seleccioná un rol.");

    const datos = {
      nombreCompleto: nombre,
      telefono,
      cargo,
      rolId: usuario?.esOwner ? null : rolId || null,
      empleadoId: empleado?.id ?? null,
      sucursalIds: sucursales ? Array.from(sucursalIds) : null,
    };

    startTransition(async () => {
      try {
        const res = usuario
          ? await editarUsuario(usuario.userId, datos)
          : await crearUsuario({ ...datos, email, password });
        if (!res.ok) {
          setError(res.message ?? "No se pudo guardar.");
          show(res.message ?? "No se pudo guardar.", "error");
          return;
        }
        show(usuario ? "Usuario actualizado." : "Usuario creado. Deberá cambiar la contraseña al entrar.", "success");
        router.push("/configuracion/usuarios");
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "No se pudo guardar.";
        setError(message);
        show(message, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Datos de la persona">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="u_nombre" className={labelClass}>
              Nombre completo
            </label>
            <input id="u_nombre" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="u_email" className={labelClass}>
              Correo (usuario de ingreso)
            </label>
            <input
              id="u_email"
              type="email"
              value={email}
              disabled={!!usuario}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@materialesjcastillo.com"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="u_telefono" className={labelClass}>
              Teléfono
            </label>
            <input id="u_telefono" value={telefono} maxLength={30} onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="u_cargo" className={labelClass}>
              Cargo
            </label>
            <input id="u_cargo" value={cargo} maxLength={80} onChange={(e) => setCargo(e.target.value)} className={inputClass} />
          </div>
          {!usuario && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="u_password" className={labelClass}>
                Contraseña temporal
              </label>
              <input
                id="u_password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-neutral-400">Mínimo 8 caracteres. El usuario deberá cambiarla en su primer ingreso.</p>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Acceso">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="u_rol" className={labelClass}>
            Rol
          </label>
          {usuario?.esOwner ? (
            <p className="text-sm text-neutral-600">Owner — acceso total, no lleva rol.</p>
          ) : (
            <select
              id="u_rol"
              value={rolId}
              disabled={rolBloqueado}
              onChange={(e) => setRolId(e.target.value)}
              className={inputClass}
            >
              <option value="">Seleccioná un rol</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          )}
          {usuario?.esUnoMismo && !usuario.esOwner && (
            <p className="text-xs text-neutral-400">No podés cambiar tu propio rol.</p>
          )}
          {!usuario?.esOwner && roles.length === 0 && (
            <p className="text-xs text-amber-700">
              No hay roles para elegir. Creá uno en{" "}
              <Link href="/configuracion/roles/nuevo" className="underline">
                Roles
              </Link>{" "}
              (o pedí el permiso para verlos).
            </p>
          )}
        </div>
      </FormSection>

      {sucursales && (
        <FormSection
          title="Sucursales"
          description="Dónde trabaja. Con una sola, al iniciar atención se usa sin preguntar; con varias, elige al iniciar."
        >
          {sucursales.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Todavía no hay sucursales.{" "}
              <Link href="/configuracion/sucursales" className="text-blue-600 underline">
                Crear una
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={sucursalIds.has(s.id)}
                    onChange={(e) =>
                      setSucursalIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          )}
        </FormSection>
      )}

      <FormSection title="Empleado de RRHH" description="Opcional: vincula la cuenta con el expediente de la persona.">
        <EmpleadoPicker value={empleado} onChange={setEmpleado} />
      </FormSection>

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Link
          href="/configuracion/usuarios"
          className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando…" : usuario ? "Guardar cambios" : "Crear usuario"}
        </button>
      </div>
    </div>
  );
}
