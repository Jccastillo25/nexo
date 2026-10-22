"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Field, FormSection, Input, Select, useToast } from "@nexo/ui";
import type { EmpleadoBusqueda } from "@/lib/supabase/database.types";
import { buscarEmpleados, crearUsuario, editarUsuario, type CampoUsuario } from "./actions";

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

type ErroresCampo = Partial<Record<CampoUsuario, string>>;

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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
        <span className="min-w-0 truncate text-neutral-800">{value.nombre}</span>
        <Button variant="destructive-outline" size="sm" onClick={() => onChange(null)}>
          Quitar vínculo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label="Buscar empleado" error={mensaje}>
        <div className="flex gap-2">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscar();
              }
            }}
            placeholder="Nombre, apellido o cédula"
          />
          <Button variant="secondary" onClick={buscar} loading={isPending}>
            Buscar
          </Button>
        </div>
      </Field>
      {resultados && resultados.length === 0 && !mensaje && (
        <p className="text-xs text-neutral-500">Sin resultados.</p>
      )}
      {resultados && resultados.length > 0 && (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {resultados.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                {e.nombre_completo}
                {e.documento_identidad && <span className="ml-2 text-xs text-neutral-500">{e.documento_identidad}</span>}
              </span>
              {e.vinculado_a ? (
                <span className="shrink-0 text-xs text-neutral-500">Ya vinculado</span>
              ) : (
                <Button variant="link" size="sm" onClick={() => onChange({ id: e.id, nombre: e.nombre_completo })}>
                  Vincular
                </Button>
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
 * Los errores de validación (del navegador o de la Server Action, vía
 * `campo`) se muestran junto a su campo; el resto, al pie.
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
  const [errores, setErrores] = useState<ErroresCampo>({});
  const [error, setError] = useState<string | null>(null);

  const rolBloqueado = usuario?.esOwner || usuario?.esUnoMismo;

  /** Cambia un campo y borra su error. */
  function editar(campo: CampoUsuario, aplicar: () => void) {
    aplicar();
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  function validar(): ErroresCampo {
    const e: ErroresCampo = {};
    if (nombre.trim().length < 2) e.nombreCompleto = "Escribe el nombre completo.";
    if (!usuario) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Escribe un correo válido.";
      if (password.length < 8) e.password = "La contraseña temporal debe tener al menos 8 caracteres.";
    }
    if (!usuario?.esOwner && !rolId) e.rolId = "Selecciona un rol.";
    return e;
  }

  function guardar() {
    setError(null);
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) return;

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
          const message = res.message ?? "No se pudo guardar.";
          if (res.campo) setErrores({ [res.campo]: message });
          else setError(message);
          show(message, "error");
          return;
        }
        show(usuario ? "Usuario actualizado." : "Usuario creado. Deberá cambiar la contraseña al entrar.", "success");
        router.push("/configuracion/usuarios");
      } catch (err) {
        // Rechazo de transporte o error inesperado: el detalle va a la consola,
        // nunca a la pantalla.
        console.error("UsuarioForm: guardar", err);
        const message = "No se pudo guardar. Intenta de nuevo.";
        setError(message);
        show(message, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Datos de la persona">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" required error={errores.nombreCompleto}>
            <Input
              value={nombre}
              maxLength={120}
              autoComplete="name"
              onChange={(e) => editar("nombreCompleto", () => setNombre(e.target.value))}
            />
          </Field>
          <Field
            label="Correo (usuario de ingreso)"
            required={!usuario}
            hint={usuario ? "El correo no se puede cambiar después del alta." : undefined}
            error={errores.email}
          >
            <Input
              type="email"
              value={email}
              disabled={!!usuario}
              autoComplete="email"
              onChange={(e) => editar("email", () => setEmail(e.target.value))}
              placeholder="nombre@materialesjcastillo.com"
            />
          </Field>
          <Field label="Teléfono" optional error={errores.telefono}>
            <Input
              type="tel"
              value={telefono}
              maxLength={30}
              autoComplete="tel"
              onChange={(e) => editar("telefono", () => setTelefono(e.target.value))}
            />
          </Field>
          <Field label="Cargo" optional error={errores.cargo}>
            <Input
              value={cargo}
              maxLength={80}
              autoComplete="organization-title"
              onChange={(e) => editar("cargo", () => setCargo(e.target.value))}
            />
          </Field>
          {!usuario && (
            <Field
              label="Contraseña temporal"
              required
              hint="Mínimo 8 caracteres. El usuario deberá cambiarla en su primer ingreso."
              error={errores.password}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => editar("password", () => setPassword(e.target.value))}
              />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection title="Acceso">
        {usuario?.esOwner ? (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-neutral-700">Rol</span>
            <p className="text-sm text-neutral-600">Propietario: acceso total, no lleva rol.</p>
          </div>
        ) : (
          <Field
            label="Rol"
            required
            hint={usuario?.esUnoMismo ? "No puedes cambiar tu propio rol." : undefined}
            error={errores.rolId}
          >
            <Select
              value={rolId}
              disabled={rolBloqueado}
              onChange={(e) => editar("rolId", () => setRolId(e.target.value))}
            >
              <option value="">Selecciona un rol</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!usuario?.esOwner && roles.length === 0 && (
          <Alert tone="warning">
            No hay roles para elegir. Crea uno en{" "}
            <Link href="/configuracion/roles/nuevo" className="font-medium underline">
              Roles
            </Link>{" "}
            (o pide el permiso para verlos).
          </Alert>
        )}
      </FormSection>

      {sucursales && (
        <FormSection
          title="Sucursales"
          description="Dónde trabaja. Con una sola, al iniciar atención se usa sin preguntar; con varias, elige al iniciar."
        >
          {sucursales.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Todavía no hay sucursales.{" "}
              <Link href="/configuracion/sucursales" className="font-medium text-blue-600 underline">
                Crear una
              </Link>
            </p>
          ) : (
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
              <legend className="sr-only">Sucursales asignadas</legend>
              {sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600"
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
            </fieldset>
          )}
        </FormSection>
      )}

      <FormSection title="Empleado de RRHH" description="Opcional: vincula la cuenta con el expediente de la persona.">
        <EmpleadoPicker value={empleado} onChange={setEmpleado} />
      </FormSection>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/configuracion/usuarios" variant="secondary">
          Cancelar
        </ButtonLink>
        <Button onClick={guardar} loading={isPending}>
          {usuario ? "Guardar cambios" : "Crear usuario"}
        </Button>
      </div>
    </div>
  );
}
