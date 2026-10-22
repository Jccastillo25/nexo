"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Field, FormSection, Input, useToast } from "@nexo/ui";
import { METODO_CONCEPTO, TIPO_CONCEPTO, etiqueta } from "@/lib/planilla/etiquetas";
import { RUTA } from "@/lib/planilla/rutas";
import type { MetodoConcepto, TipoConcepto } from "@/lib/planilla/tipos";
import { AlertaError } from "../_compartido/alerta-error";
import { guardarConcepto } from "./actions";

/** Lo que el formulario necesita de un concepto existente (props serializables). */
export interface ConceptoEditable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  metodo: MetodoConcepto;
  afecta_inss: boolean;
  afecta_ir: boolean;
  afecta_inatec: boolean;
  cuenta_aguinaldo: boolean;
  cuenta_vacaciones: boolean;
  cuenta_indemnizacion: boolean;
  en_colilla: boolean;
  permite_novedad: boolean;
  orden: number;
  cuenta_contable: string | null;
  activo: boolean;
}

type Bandera =
  | "afectaInss"
  | "afectaIr"
  | "afectaInatec"
  | "cuentaAguinaldo"
  | "cuentaVacaciones"
  | "cuentaIndemnizacion"
  | "enColilla"
  | "permiteNovedad"
  | "activo";

interface Estado extends Record<Bandera, boolean> {
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  orden: string;
  cuentaContable: string;
}

interface Errores {
  codigo?: string;
  nombre?: string;
  orden?: string;
  cuentaContable?: string;
}

const CODIGO = /^[A-Z][A-Z0-9_]{1,39}$/;
const CONTROL =
  "size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed";
const LEYENDA = "mb-1.5 text-[13px] leading-5 font-medium text-neutral-700";

const AFECTA: readonly [Bandera, string][] = [
  ["afectaInss", "INSS"],
  ["afectaIr", "IR"],
  ["afectaInatec", "INATEC"],
];
const CUENTA_PARA: readonly [Bandera, string][] = [
  ["cuentaAguinaldo", "Aguinaldo"],
  ["cuentaVacaciones", "Vacaciones"],
  ["cuentaIndemnizacion", "Indemnización"],
];

function inicial(c: ConceptoEditable | null): Estado {
  return {
    codigo: c?.codigo ?? "",
    nombre: c?.nombre ?? "",
    tipo: c?.tipo ?? "devengado",
    afectaInss: c?.afecta_inss ?? false,
    afectaIr: c?.afecta_ir ?? false,
    afectaInatec: c?.afecta_inatec ?? false,
    cuentaAguinaldo: c?.cuenta_aguinaldo ?? false,
    cuentaVacaciones: c?.cuenta_vacaciones ?? false,
    cuentaIndemnizacion: c?.cuenta_indemnizacion ?? false,
    enColilla: c?.en_colilla ?? true,
    permiteNovedad: c?.permite_novedad ?? true,
    orden: String(c?.orden ?? 500),
    cuentaContable: c?.cuenta_contable ?? "",
    activo: c?.activo ?? true,
  };
}

function validar(e: Estado, sistema: boolean): Errores {
  const r: Errores = {};
  // El código de un concepto del sistema no se edita: se reenvía el guardado.
  if (!sistema && !CODIGO.test(e.codigo.trim())) {
    r.codigo = "De 2 a 40 letras mayúsculas, números o guion bajo, y empieza con una letra.";
  }
  const nombre = e.nombre.trim();
  if (nombre.length < 1 || nombre.length > 80) r.nombre = "Indica el nombre (hasta 80 caracteres).";
  const orden = Number(e.orden);
  if (!/^\d{1,4}$/.test(e.orden.trim()) || orden < 1 || orden > 9999) r.orden = "Indica un número entero de 1 a 9999.";
  if (e.cuentaContable.trim().length > 40) r.cuentaContable = "Hasta 40 caracteres.";
  return r;
}

/**
 * Formulario de un concepto (A8), con conceptos.gestionar.
 *
 * Propio: ingreso o deducción de monto fijo (las horas extra, ausencias,
 * aportes y provisiones los calcula el sistema). El código no cambia al
 * editar (D15). Una deducción no afecta INSS, IR ni INATEC ni cuenta para
 * prestaciones: esas casillas se apagan.
 *
 * Del sistema (`sistema`, solo al editar): formulario reducido con nombre,
 * "Aparece en la colilla" y cuenta contable. Los demás campos (código, tipo,
 * método, reglas, admite novedades, orden y activo) se reenvían SIN cambios,
 * con los valores guardados: planilla_concepto_guardar rechaza cualquier otro
 * cambio en un concepto del sistema.
 *
 * Un solo canal de error (AlertaError arriba, con el foco); el éxito, en un
 * toast. La RPC vuelve a validar todo.
 */
export function ConceptoForm({ concepto, sistema = false }: { concepto: ConceptoEditable | null; sistema?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [e, setE] = useState<Estado>(() => inicial(concepto));
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const editando = concepto !== null;
  const reducido = sistema && editando;
  const metodo: MetodoConcepto = concepto?.metodo ?? "fijo";
  const deduccion = e.tipo === "deduccion";

  function campo<K extends keyof Estado>(clave: K, valor: Estado[K]) {
    setE((prev) => ({ ...prev, [clave]: valor }));
    if (clave in errores) setErrores((prev) => ({ ...prev, [clave]: undefined }));
  }

  function elegirTipo(tipo: TipoConcepto) {
    setE((prev) =>
      tipo === "deduccion"
        ? {
            ...prev,
            tipo,
            afectaInss: false,
            afectaIr: false,
            afectaInatec: false,
            cuentaAguinaldo: false,
            cuentaVacaciones: false,
            cuentaIndemnizacion: false,
          }
        : { ...prev, tipo }
    );
  }

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const nuevos = validar(e, reducido);
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) {
      setError("Revisa los campos marcados.");
      return;
    }
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    // Concepto del sistema: todo lo que no es nombre, colilla o cuenta contable va tal como está guardado.
    const fijo = reducido && concepto ? concepto : null;
    startTransition(async () => {
      const r = await guardarConcepto({
        conceptoId: concepto?.id ?? null,
        codigo: fijo ? fijo.codigo : e.codigo.trim(),
        nombre: e.nombre.trim(),
        tipo: fijo ? fijo.tipo : e.tipo,
        metodo,
        afectaInss: fijo ? fijo.afecta_inss : e.afectaInss,
        afectaIr: fijo ? fijo.afecta_ir : e.afectaIr,
        afectaInatec: fijo ? fijo.afecta_inatec : e.afectaInatec,
        cuentaAguinaldo: fijo ? fijo.cuenta_aguinaldo : e.cuentaAguinaldo,
        cuentaVacaciones: fijo ? fijo.cuenta_vacaciones : e.cuentaVacaciones,
        cuentaIndemnizacion: fijo ? fijo.cuenta_indemnizacion : e.cuentaIndemnizacion,
        enColilla: e.enColilla,
        permiteNovedad: fijo ? fijo.permite_novedad : e.permiteNovedad,
        orden: fijo ? fijo.orden : Number(e.orden),
        cuentaContable: e.cuentaContable.trim() || null,
        activo: fijo ? fijo.activo : e.activo,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      toast.show(editando ? "Cambios guardados." : "Concepto creado.", "success");
      router.push(RUTA.conceptos());
    });
  }

  function casilla(clave: Bandera, texto: string, deshabilitada = false) {
    return (
      <label key={clave} className="flex items-center gap-2 text-sm text-neutral-800">
        <input
          type="checkbox"
          className={CONTROL}
          checked={e[clave]}
          onChange={(ev) => campo(clave, ev.target.checked)}
          disabled={deshabilitada || pendiente}
        />
        {texto}
      </label>
    );
  }

  const alertaError = error ? (
    <AlertaError title={editando ? "No se pudieron guardar los cambios" : "No se pudo crear el concepto"}>{error}</AlertaError>
  ) : null;
  const campoNombre = (
    <Field label="Nombre" required error={errores.nombre}>
      <Input
        value={e.nombre}
        onChange={(ev) => campo("nombre", ev.target.value)}
        maxLength={80}
        autoComplete="off"
        disabled={pendiente}
        required
      />
    </Field>
  );
  const campoCuenta = (
    <Field label="Cuenta contable" optional error={errores.cuentaContable}>
      <Input
        value={e.cuentaContable}
        onChange={(ev) => campo("cuentaContable", ev.target.value)}
        maxLength={40}
        autoComplete="off"
        disabled={pendiente}
      />
    </Field>
  );
  const botones = (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={RUTA.conceptos()} variant="secondary">
        Cancelar
      </ButtonLink>
      <Button type="submit" loading={pendiente}>
        {editando ? "Guardar cambios" : "Crear concepto"}
      </Button>
    </div>
  );

  if (reducido) {
    return (
      <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
        {alertaError}
        <FormSection title="Datos que se pueden cambiar">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {campoNombre}
            {campoCuenta}
          </div>
          {casilla("enColilla", "Aparece en la colilla")}
        </FormSection>
        {botones}
      </form>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      {alertaError}

      <FormSection title="Datos del concepto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Código"
            required
            error={errores.codigo}
            hint={editando ? "El código no cambia al editar." : "En mayúsculas, sin espacios. Ejemplo: BONO_PRODUCCION."}
          >
            <Input
              value={e.codigo}
              onChange={(ev) => campo("codigo", ev.target.value.toUpperCase().replace(/\s+/g, "_"))}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              readOnly={editando}
              disabled={pendiente}
              required
            />
          </Field>
          {campoNombre}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className={LEYENDA}>
              Tipo
              <span aria-hidden="true" className="ml-0.5 text-red-600">
                *
              </span>
            </legend>
            {(["devengado", "deduccion"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name={`${id}-tipo`}
                  className={CONTROL}
                  checked={e.tipo === t}
                  onChange={() => elegirTipo(t)}
                  disabled={pendiente}
                />
                {TIPO_CONCEPTO[t]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col">
            <p className={LEYENDA}>Método</p>
            <p className="text-sm text-neutral-800">{etiqueta(METODO_CONCEPTO, metodo)}</p>
            <p className="mt-1.5 text-xs text-neutral-500">
              Los conceptos propios son de monto fijo. Las horas extra, ausencias, aportes y provisiones los calcula el
              sistema.
            </p>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Reglas de cálculo"
        description={
          deduccion
            ? "Una deducción no afecta INSS, IR ni INATEC ni cuenta para prestaciones."
            : "Marca a qué afecta este ingreso y para qué prestaciones cuenta."
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className={LEYENDA}>Afecta</legend>
            {AFECTA.map(([clave, texto]) => casilla(clave, texto, deduccion))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className={LEYENDA}>Cuenta para</legend>
            {CUENTA_PARA.map(([clave, texto]) => casilla(clave, texto, deduccion))}
          </fieldset>
        </div>
      </FormSection>

      <FormSection title="Presentación y uso">
        <div className="flex flex-col gap-2">
          {casilla("enColilla", "Aparece en la colilla")}
          {casilla("permiteNovedad", "Admite novedades (se captura por persona en cada período)")}
          {casilla("activo", "Activo")}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Orden" required error={errores.orden} hint="Posición en la colilla y en los reportes (1 a 9999).">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              step={1}
              value={e.orden}
              onChange={(ev) => campo("orden", ev.target.value)}
              disabled={pendiente}
              required
            />
          </Field>
          {campoCuenta}
        </div>
        <p className="text-xs text-neutral-500">
          Un concepto ya usado en una planilla aprobada no cambia en ella: las líneas guardan una copia de sus reglas.
        </p>
      </FormSection>

      {botones}
    </form>
  );
}
