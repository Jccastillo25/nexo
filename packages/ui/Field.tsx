"use client";

// Campo de formulario de la suite (Nexo Enterprise UI v2, 2026-10-20):
// etiqueta + control + ayuda + error, con la accesibilidad resuelta en un solo
// lugar. Field reparte por contexto el id del control y los ids de ayuda y
// error; Input/Select/Textarea los toman solos, asi que el error queda
// conectado al campo (aria-invalid + aria-describedby) sin cablearlo a mano.
//
//   <Field label="Nombre" required error={errores.nombre} hint="Como aparece en la cédula">
//     <Input name="nombre" defaultValue={empleado.nombre} autoComplete="name" />
//   </Field>
//
// Los controles aceptan todas las props nativas (name, defaultValue, required,
// onChange...), asi que sirven igual en formularios de Server Action sin
// estado controlado que en formularios controlados. Fuera de un Field
// tambien funcionan (pasales id y aria-* a mano).
import { createContext, useContext, useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { controlClassName, controlHeightClassName } from "./control-classes";
import { NexoIcon } from "./nexo-icons";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function joinIds(...ids: (string | undefined)[]): string | undefined {
  const list = ids.filter(Boolean);
  return list.length > 0 ? list.join(" ") : undefined;
}

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  /** Texto de ayuda bajo el control (12px, neutral-500). */
  hint?: ReactNode;
  /** Mensaje de error: que paso y como corregirlo. Vacio = sin error. */
  error?: ReactNode;
  /** Muestra el asterisco y marca el control con aria-required. Para la
   * validacion nativa del navegador pasa ademas `required` al control. */
  required?: boolean;
  /** Muestra "(opcional)" junto a la etiqueta. */
  optional?: boolean;
  /** id del control; por defecto se genera con useId(). */
  id?: string;
  className?: string;
}

export function Field({ label, children, hint, error, required = false, optional = false, id, className }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `${autoId}campo`;
  const hintId = hint ? `${controlId}-ayuda` : undefined;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  const errorId = hasError ? `${controlId}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{ id: controlId, describedBy: joinIds(hintId, errorId), invalid: hasError, required }}
    >
      <div className={`flex min-w-0 flex-col ${className ?? ""}`}>
        <label htmlFor={controlId} className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          ) : null}
          {optional && !required ? <span className="ml-1 font-normal text-neutral-500">(opcional)</span> : null}
        </label>
        {children}
        {hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-neutral-500">
            {hint}
          </p>
        ) : null}
        {/* Region viva siempre montada: un error que aparece despues de enviar
            se anuncia sin mover el foco. */}
        <div aria-live="polite">
          {hasError ? (
            <p id={errorId} className="mt-1.5 flex items-start gap-1 text-xs text-red-600">
              <NexoIcon name="alert-circle" className="mt-px size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
        </div>
      </div>
    </FieldContext.Provider>
  );
}

/** Lee el contexto del Field (si hay) y mezcla sus ids/estado con las props del control. */
function useFieldControl({
  id,
  required,
  invalid,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  required?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: ComponentPropsWithRef<"input">["aria-invalid"];
}) {
  const field = useContext(FieldContext);
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true" || field?.invalid === true);
  return {
    id: id ?? field?.id,
    required,
    "aria-required": !required && field?.required ? true : undefined,
    "aria-invalid": isInvalid ? true : undefined,
    "aria-describedby": joinIds(field?.describedBy, describedBy),
  } as const;
}

export interface InputProps extends ComponentPropsWithRef<"input"> {
  /** Fuerza el estado invalido (dentro de un Field lo da `error`). */
  invalid?: boolean;
}

/** Input de texto, numero, fecha, correo... (no para checkbox/radio). */
export function Input({
  className,
  id,
  required,
  invalid,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...rest
}: InputProps) {
  const a11y = useFieldControl({ id, required, invalid, "aria-describedby": describedBy, "aria-invalid": ariaInvalid });
  return (
    <input {...rest} {...a11y} className={`${controlClassName} ${controlHeightClassName} ${className ?? ""}`} />
  );
}

export interface SelectProps extends ComponentPropsWithRef<"select"> {
  invalid?: boolean;
  /** Clases del <select>. `className` va al contenedor (ancho, margenes). */
  selectClassName?: string;
}

/** Select nativo con la flecha de la suite. `className` controla el ancho del contenedor. */
export function Select({
  className,
  selectClassName,
  id,
  required,
  invalid,
  multiple,
  size,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  children,
  ...rest
}: SelectProps) {
  const a11y = useFieldControl({ id, required, invalid, "aria-describedby": describedBy, "aria-invalid": ariaInvalid });
  if (multiple || (size !== undefined && size > 1)) {
    return (
      <select
        {...rest}
        {...a11y}
        multiple={multiple}
        size={size}
        className={`${controlClassName} py-1.5 ${className ?? ""} ${selectClassName ?? ""}`}
      >
        {children}
      </select>
    );
  }
  return (
    <div className={`relative w-full min-w-0 ${className ?? ""}`}>
      <select
        {...rest}
        {...a11y}
        size={size}
        className={`${controlClassName} ${controlHeightClassName} appearance-none pr-9 ${selectClassName ?? ""}`}
      >
        {children}
      </select>
      <NexoIcon
        name="chevron-down"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-500"
      />
    </div>
  );
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function Textarea({
  className,
  id,
  required,
  invalid,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...rest
}: TextareaProps) {
  const a11y = useFieldControl({ id, required, invalid, "aria-describedby": describedBy, "aria-invalid": ariaInvalid });
  return (
    <textarea
      {...rest}
      {...a11y}
      className={`${controlClassName} min-h-20 resize-y py-2 leading-normal ${className ?? ""}`}
    />
  );
}
