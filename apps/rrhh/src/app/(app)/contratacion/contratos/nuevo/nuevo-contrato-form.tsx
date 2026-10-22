"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, ButtonLink, Field, Input, Select, useToast } from "@nexo/ui";
import { crearContrato, type CrearContratoInput } from "../actions";

export interface EmpleadoOption {
  id: string;
  nombreCompleto: string;
  codigoEmpleado: number;
  documentoIdentidad: string | null;
  /** Id del contrato activo/borrador existente, si lo tiene — permite
   * enlazarlo directo en vez de solo avisar que existe. */
  contratoAbiertoId: string | null;
}

export interface PuestoOption {
  id: string;
  nombre: string;
  departamentoId: string | null;
}

export interface DepartamentoOption {
  id: string;
  nombre: string;
}

export interface PlantillaOption {
  id: string;
  nombre: string;
}

export interface PuestoPlantillaOption {
  puestoId: string;
  plantillaId: string;
  predeterminada: boolean;
}

const EMPTY_FORM: CrearContratoInput = {
  puestoId: "",
  departamentoId: "",
  plantillaContratoId: "",
  modalidadContrato: "nomina_estandar",
  fechaInicio: "",
  salarioBase: undefined,
};

/**
 * Búsqueda simple (filtro client-side sobre la lista ya cargada — no hace
 * falta una nueva RPC de búsqueda para el tamaño real de plantilla de la
 * empresa) + selección de empleado, seguida del formulario de datos base
 * del contrato.
 *
 * 2026-09-17 (auditoría del botón "Crear borrador" deshabilitado): el
 * `<select>` de empleados tiene una opción con `value=""` explícita (sin
 * ella, el navegador resaltaba el primer empleado mientras el estado seguía
 * vacío) y un motivo siempre visible junto al botón cuando está
 * deshabilitado.
 *
 * Reglas de negocio (2026-09-17, ver supabase/migrations/20260917100000_...):
 * puesto/departamento/plantilla son obligatorios; el departamento se elige
 * primero y filtra los puestos; la plantilla se filtra por las asignadas a
 * ese puesto (rrhh.puesto_plantillas) y se preselecciona la predeterminada;
 * sin "Fin previsto" en este formulario (rrhh.fn_crear_contrato no acepta
 * ese parámetro).
 */
export default function NuevoContratoForm({
  empleados,
  puestos,
  departamentos,
  plantillas,
  puestoPlantillas,
  canEditarSalario,
}: {
  empleados: EmpleadoOption[];
  puestos: PuestoOption[];
  departamentos: DepartamentoOption[];
  plantillas: PlantillaOption[];
  puestoPlantillas: PuestoPlantillaOption[];
  canEditarSalario: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const motivoId = useId();
  const [query, setQuery] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [form, setForm] = useState<CrearContratoInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter(
      (e) =>
        e.nombreCompleto.toLowerCase().includes(q) ||
        String(e.codigoEmpleado).includes(q) ||
        (e.documentoIdentidad ?? "").toLowerCase().includes(q)
    );
  }, [empleados, query]);

  const seleccionado = empleados.find((e) => e.id === empleadoId) ?? null;

  const puestosDelDepartamento = useMemo(
    () => puestos.filter((p) => p.departamentoId === form.departamentoId),
    [puestos, form.departamentoId]
  );

  const plantillasDelPuesto = useMemo(() => {
    if (!form.puestoId) return [];
    const idsAsignados = new Set(
      puestoPlantillas.filter((pp) => pp.puestoId === form.puestoId).map((pp) => pp.plantillaId)
    );
    return plantillas.filter((p) => idsAsignados.has(p.id));
  }, [plantillas, puestoPlantillas, form.puestoId]);

  function update<K extends keyof CrearContratoInput>(key: K, value: CrearContratoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Departamento cambia → limpiar puesto si ya no pertenece a él (y su
  // plantilla, que depende del puesto). Puesto cambia → preseleccionar la
  // plantilla predeterminada de ese puesto si tiene una.
  function cambiarDepartamento(departamentoId: string) {
    setForm((f) => {
      const puestoSigueValido = puestos.some(
        (p) => p.id === f.puestoId && p.departamentoId === departamentoId
      );
      return {
        ...f,
        departamentoId,
        puestoId: puestoSigueValido ? f.puestoId : "",
        plantillaContratoId: puestoSigueValido ? f.plantillaContratoId : "",
      };
    });
  }

  function cambiarPuesto(puestoId: string) {
    const predeterminada = puestoPlantillas.find((pp) => pp.puestoId === puestoId && pp.predeterminada);
    setForm((f) => ({ ...f, puestoId, plantillaContratoId: predeterminada?.plantillaId ?? "" }));
  }

  // Motivo de bloqueo del botón, en orden de prioridad — siempre visible
  // cuando el botón está deshabilitado. Enlaza al contrato existente cuando
  // lo hay.
  const motivo: { texto: string; href?: string } | null = useMemo(() => {
    if (!empleadoId) return { texto: "Elige un empleado de la lista para continuar." };
    if (seleccionado?.contratoAbiertoId) {
      return {
        texto: "Este empleado ya tiene un contrato activo o en borrador.",
        href: `/contratacion/contratos/${seleccionado.contratoAbiertoId}`,
      };
    }
    if (!form.departamentoId) return { texto: "Elige un departamento." };
    if (!form.puestoId) {
      return puestosDelDepartamento.length === 0
        ? { texto: "Este departamento no tiene puestos activos. Crea uno en Catálogos → Puestos." }
        : { texto: "Elige un puesto de ese departamento." };
    }
    if (!form.plantillaContratoId) {
      return plantillasDelPuesto.length === 0
        ? { texto: "Este puesto no tiene plantillas de contrato asignadas. Asigna una en Catálogos → Puestos." }
        : { texto: "Elige una plantilla de contrato." };
    }
    return null;
  }, [empleadoId, seleccionado, form, puestosDelDepartamento.length, plantillasDelPuesto.length]);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (motivo || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await crearContrato(empleadoId, form);
      if (!res.ok || !res.contratoId) {
        setError(res.message ?? "No se pudo crear el contrato.");
        show(res.message ?? "No se pudo crear el contrato.", "error");
        return;
      }
      show("Contrato creado en borrador.", "success");
      router.push(`/contratacion/contratos/${res.contratoId}`);
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      <section
        aria-labelledby="nuevo-contrato-empleado"
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <h2 id="nuevo-contrato-empleado" className="text-sm font-semibold text-neutral-900">
          Empleado
        </h2>
        <Field label="Buscar empleado">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, código o documento"
            autoComplete="off"
          />
        </Field>
        <Field label="Empleado" required hint={filtrados.length === 0 ? "Ningún empleado coincide con la búsqueda." : undefined}>
          <Select
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            size={Math.min(8, Math.max(4, filtrados.length + 1))}
          >
            <option value="">Elige un empleado</option>
            {filtrados.map((e) => (
              <option key={e.id} value={e.id} disabled={!!e.contratoAbiertoId}>
                {e.nombreCompleto} — #{e.codigoEmpleado}
                {e.documentoIdentidad ? ` · ${e.documentoIdentidad}` : ""}
                {e.contratoAbiertoId ? " (ya tiene un contrato activo o en borrador)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section
        aria-labelledby="nuevo-contrato-datos"
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <h2 id="nuevo-contrato-datos" className="text-sm font-semibold text-neutral-900">
          Datos del contrato
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Departamento"
            required
            hint={
              departamentos.length === 0
                ? "Todavía no hay departamentos. Créalos en Contratación → Catálogos → Departamentos."
                : undefined
            }
          >
            <Select value={form.departamentoId} onChange={(e) => cambiarDepartamento(e.target.value)}>
              <option value="">Elige un departamento</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Puesto"
            required
            hint={
              form.departamentoId && puestosDelDepartamento.length === 0
                ? "Este departamento todavía no tiene puestos activos."
                : undefined
            }
          >
            <Select
              value={form.puestoId}
              onChange={(e) => cambiarPuesto(e.target.value)}
              disabled={!form.departamentoId}
            >
              <option value="">{form.departamentoId ? "Elige un puesto" : "Elige primero un departamento"}</option>
              {puestosDelDepartamento.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Plantilla de contrato"
            required
            hint={
              form.puestoId && plantillasDelPuesto.length === 0
                ? "Este puesto no tiene plantillas asignadas. Asígnalas en Contratación → Catálogos → Puestos."
                : undefined
            }
          >
            <Select
              value={form.plantillaContratoId}
              onChange={(e) => update("plantillaContratoId", e.target.value)}
              disabled={!form.puestoId}
            >
              <option value="">{form.puestoId ? "Elige una plantilla" : "Elige primero un puesto"}</option>
              {plantillasDelPuesto.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Modalidad">
            <Select
              value={form.modalidadContrato}
              onChange={(e) => update("modalidadContrato", e.target.value as CrearContratoInput["modalidadContrato"])}
            >
              <option value="nomina_estandar">Nómina estándar</option>
              <option value="comisionista_destajo">Comisionista / destajo</option>
            </Select>
          </Field>
          <Field label="Fecha de inicio" optional>
            <Input type="date" value={form.fechaInicio} onChange={(e) => update("fechaInicio", e.target.value)} />
          </Field>
          {canEditarSalario ? (
            <Field label="Salario base (C$)" optional>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.salarioBase ?? ""}
                onChange={(e) => update("salarioBase", e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
          ) : null}
        </div>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/contratacion/contratos" variant="ghost">
            Cancelar
          </ButtonLink>
          <Button
            type="submit"
            loading={isPending}
            disabled={!!motivo}
            aria-describedby={motivo ? motivoId : undefined}
          >
            {isPending ? "Creando…" : "Crear borrador"}
          </Button>
        </div>
        {motivo ? (
          <p id={motivoId} className="text-xs text-amber-700">
            {motivo.texto}
            {motivo.href ? (
              <>
                {" "}
                <Link
                  href={motivo.href}
                  className="rounded-sm font-medium underline hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Ver ese contrato
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </form>
  );
}
