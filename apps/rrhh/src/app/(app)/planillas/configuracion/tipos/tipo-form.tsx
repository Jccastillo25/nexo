"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Field, FormSection, Input, Select, useToast } from "@nexo/ui";
import { CLASE_PLANILLA, FRECUENCIA } from "@/lib/planilla/etiquetas";
import { RUTA } from "@/lib/planilla/rutas";
import type { ClasePlanilla, Frecuencia } from "@/lib/planilla/tipos";
import { AlertaError } from "../_compartido/alerta-error";
import { guardarTipoPlanilla } from "./actions";

/** Lo que el formulario necesita de un tipo existente (props serializables). */
export interface TipoEditable {
  id: string;
  nombre: string;
  clase: ClasePlanilla;
  frecuencia: Frecuencia;
  centro_costo: string | null;
  activo: boolean;
}

const ORDINARIAS: readonly Frecuencia[] = ["quincenal", "mensual", "semanal"];
const CONTROL =
  "size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed";
const LEYENDA = "mb-1.5 text-[13px] leading-5 font-medium text-neutral-700";

/**
 * Formulario de un tipo de planilla (A9): nombre, clase (ordinaria con
 * frecuencia quincenal, mensual o semanal; aguinaldo, siempre anual), centro
 * de costo y estado. Al editar, la clase queda deshabilitada: la RPC nunca la
 * deja cambiar. Un solo canal de error (AlertaError arriba, con el foco); el
 * éxito, en un toast. La RPC vuelve a validar todo.
 */
export function TipoForm({ tipo }: { tipo: TipoEditable | null }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const editando = tipo !== null;
  const [nombre, setNombre] = useState(tipo?.nombre ?? "");
  const [clase, setClase] = useState<ClasePlanilla>(tipo?.clase ?? "ordinaria");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(tipo?.frecuencia ?? "quincenal");
  const [centro, setCentro] = useState(tipo?.centro_costo ?? "");
  const [activo, setActivo] = useState(tipo?.activo ?? true);
  const [errores, setErrores] = useState<{ nombre?: string; centro?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function elegirClase(nueva: ClasePlanilla) {
    setClase(nueva);
    setFrecuencia(nueva === "aguinaldo" ? "anual" : ORDINARIAS.includes(frecuencia) ? frecuencia : "quincenal");
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos: { nombre?: string; centro?: string } = {};
    const n = nombre.trim();
    if (n.length < 1 || n.length > 80) nuevos.nombre = "Indica el nombre (hasta 80 caracteres).";
    if (centro.trim().length > 80) nuevos.centro = "Hasta 80 caracteres.";
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.centro) {
      setError("Revisa los campos marcados.");
      return;
    }
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await guardarTipoPlanilla({
        tipoId: tipo?.id ?? null,
        nombre: n,
        // Al editar se reenvía la clase guardada: nunca cambia.
        clase: tipo ? tipo.clase : clase,
        frecuencia: clase === "aguinaldo" ? "anual" : frecuencia,
        centroCosto: centro.trim() || null,
        activo,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      toast.show(editando ? "Cambios guardados." : "Tipo de planilla creado.", "success");
      router.push(RUTA.tipos());
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      {error ? (
        <AlertaError title={editando ? "No se pudieron guardar los cambios" : "No se pudo crear el tipo de planilla"}>
          {error}
        </AlertaError>
      ) : null}

      <FormSection
        title="Datos del tipo de planilla"
        description="Solo puede haber un tipo activo por clase y frecuencia: un contrato entra en la planilla ordinaria de su misma frecuencia de pago."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={errores.nombre}>
            <Input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (errores.nombre) setErrores((p) => ({ ...p, nombre: undefined }));
              }}
              maxLength={80}
              autoComplete="off"
              disabled={pendiente}
              required
            />
          </Field>
          <Field label="Centro de costo" optional error={errores.centro}>
            <Input
              value={centro}
              onChange={(e) => setCentro(e.target.value)}
              maxLength={80}
              autoComplete="off"
              disabled={pendiente}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2" aria-describedby={editando ? `${id}-clase-fija` : undefined}>
            <legend className={LEYENDA}>
              Clase
              <span aria-hidden="true" className="ml-0.5 text-red-600">
                *
              </span>
            </legend>
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name={`${id}-clase`}
                className={`${CONTROL} mt-0.5`}
                checked={clase === "ordinaria"}
                onChange={() => elegirClase("ordinaria")}
                disabled={editando || pendiente}
              />
              <span>
                {CLASE_PLANILLA.ordinaria}
                <span className="block text-xs text-neutral-500">Quincenal, mensual o semanal.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name={`${id}-clase`}
                className={`${CONTROL} mt-0.5`}
                checked={clase === "aguinaldo"}
                onChange={() => elegirClase("aguinaldo")}
                disabled={editando || pendiente}
              />
              <span>
                {CLASE_PLANILLA.aguinaldo}
                <span className="block text-xs text-neutral-500">Siempre anual.</span>
              </span>
            </label>
            {editando ? (
              <p id={`${id}-clase-fija`} className="text-xs text-neutral-500">
                La clase no cambia. Para otra clase, crea otro tipo.
              </p>
            ) : null}
          </fieldset>
          {clase === "ordinaria" ? (
            <Field label="Frecuencia" required>
              <Select
                value={frecuencia}
                onChange={(e) => {
                  const v = e.target.value as Frecuencia;
                  setFrecuencia(ORDINARIAS.includes(v) ? v : "quincenal");
                }}
                disabled={pendiente}
                required
              >
                {ORDINARIAS.map((f) => (
                  <option key={f} value={f}>
                    {FRECUENCIA[f]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="flex flex-col">
              <p className={LEYENDA}>Frecuencia</p>
              <p className="text-sm text-neutral-800">{FRECUENCIA.anual}</p>
            </div>
          )}
        </div>
        {clase === "ordinaria" && frecuencia === "semanal" ? (
          <Alert tone="warning">
            La retención de IR en planilla semanal todavía no está definida: el cálculo se detendrá hasta que el contador la
            defina.
          </Alert>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            className={CONTROL}
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            disabled={pendiente}
          />
          Activo
        </label>
        {editando ? (
          <p className="text-xs text-neutral-500">
            Un tipo que ya tiene planillas o novedades no cambia de frecuencia.
          </p>
        ) : null}
      </FormSection>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={RUTA.tipos()} variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" loading={pendiente}>
          {editando ? "Guardar cambios" : "Crear tipo de planilla"}
        </Button>
      </div>
    </form>
  );
}
