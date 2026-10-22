// Boton de la suite (Nexo Enterprise UI v2, 2026-10-20) — reemplaza los
// botones primarios escritos a mano en cada pantalla (habia ~46 copias de
// "rounded-md bg-blue-600 px-4 py-2 ..."). Tres piezas:
//
//   - Button: <button>. Por defecto type="button" (no envia formularios por
//     accidente); pasa type="submit" dentro de un <form action={...}>.
//   - ButtonLink: el mismo aspecto sobre next/link, para navegar dentro del
//     modulo (respeta el basePath). Para cruzar de zona usar un <a> plano con
//     buttonClassName().
//   - buttonClassName(): las clases sueltas, para casos raros (un <a> que
//     cruza de zona, un <label> de input de archivo).
//
// Sin "use client": sirve en Server Components (un boton de submit de una
// Server Action) y en componentes cliente con onClick. El estado de carga
// automatico de un formulario con Server Action lo da SubmitButton (lee
// useFormStatus); con onSubmit + useTransition pasa loading={isPending}.
import Link from "next/link";
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-outline" | "link";
export type ButtonSize = "sm" | "md" | "lg";

// `interactive` va aparte para no aplicar hover/active cuando el boton esta
// deshabilitado o cargando (un boton apagado que cambia de color al pasar
// el cursor parece usable).
const VARIANTS: Record<ButtonVariant, { base: string; interactive: string }> = {
  primary: {
    base: "bg-blue-600 text-white shadow-xs",
    interactive: "hover:bg-blue-700 active:bg-blue-800",
  },
  secondary: {
    base: "border border-neutral-300 bg-white text-neutral-800 shadow-xs",
    interactive: "hover:bg-neutral-50 active:bg-neutral-100",
  },
  ghost: {
    base: "text-neutral-700",
    interactive: "hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200",
  },
  destructive: {
    base: "bg-red-600 text-white shadow-xs",
    interactive: "hover:bg-red-700 active:bg-red-800",
  },
  "destructive-outline": {
    base: "border border-red-300 bg-white text-red-700 shadow-xs",
    interactive: "hover:bg-red-50 active:bg-red-100",
  },
  link: {
    base: "text-blue-600 underline-offset-4",
    interactive: "hover:text-blue-700 hover:underline",
  },
};

// sm 32px · md 36px · lg 40px. md y lg suben a 44px en movil (<640px):
// objetivo tactil minimo de las acciones principales. sm queda en 32px para
// tablas y barras densas.
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  md: "h-9 px-3.5 max-sm:min-h-11",
  lg: "h-10 px-4 max-sm:min-h-11",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
// Tambien cubre el caso de un <fieldset disabled> que apaga el boton sin la prop.
const DISABLED_ATTR = "disabled:cursor-not-allowed disabled:opacity-50";

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ocupa todo el ancho del contenedor (formularios en movil). */
  fullWidth?: boolean;
  /** Pinta el estado deshabilitado (opacidad + cursor) sin depender del atributo. */
  disabled?: boolean;
  /** Cargando: deshabilitado pero sin atenuar, con cursor de espera. */
  loading?: boolean;
  className?: string;
}

/** Clases del boton de la suite, para elementos que no son <Button>/<ButtonLink>. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  className,
}: ButtonClassOptions = {}): string {
  const v = VARIANTS[variant];
  return [
    BASE,
    variant === "link" ? "" : SIZES[size],
    v.base,
    disabled || loading ? "" : v.interactive,
    // Cargando: apagado pero sin atenuar, para que el spinner se lea.
    loading ? "cursor-progress" : disabled ? "cursor-not-allowed opacity-50" : DISABLED_ATTR,
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Indicador de carga de 16px. Con `label` se anuncia (role="status"); sin
 * `label` es decorativo (el contenedor ya comunica el estado). */
export function Spinner({ className = "size-4", label }: { className?: string; label?: string }) {
  const svg = (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`animate-spin motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (!label) return svg;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Muestra el spinner, marca aria-busy/aria-disabled y bloquea el clic y el
   * envio del formulario (evita el doble envio). No pone `disabled`: el boton
   * conserva el foco del teclado mientras carga. Es un estado de cliente
   * (useTransition, useFormStatus); no se usa desde un Server Component.
   */
  loading?: boolean;
  /** Icono a la izquierda del texto (p. ej. <NexoIcon name="upload" />). */
  icon?: ReactNode;
  fullWidth?: boolean;
}

// Mientras carga, el clic se cancela. preventDefault en el clic de un boton
// submit tambien cancela el envio, incluido el implicito (Enter en un campo:
// el navegador lo convierte en un clic sobre el boton por defecto), asi que
// no hace falta `disabled` para evitar el doble envio.
function bloquearClic(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

/**
 * Boton de accion. Ejemplo:
 *   <Button type="submit" loading={isPending} icon={<NexoIcon name="check-circle" />}>Guardar cambios</Button>
 *   <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth,
  className,
  disabled,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  // `disabled` real solo con la prop: con `disabled` el navegador saca el
  // foco del boton y el teclado cae en el <body> mientras carga.
  const ocupado = loading && !disabled;
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={ocupado || undefined}
      aria-busy={loading || undefined}
      onClick={ocupado ? bloquearClic : onClick}
      className={buttonClassName({ variant, size, fullWidth, disabled, loading, className })}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {loading ? <span className="sr-only">, procesando</span> : null}
    </button>
  );
}

export type ButtonLinkProps = Omit<ComponentPropsWithRef<typeof Link>, "className" | "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
  /** Se muestra apagado y no navega (p. ej. "Anterior" en la primera pagina). */
  disabled?: boolean;
};

/**
 * Enlace con aspecto de boton (next/link, navegacion dentro del modulo). Ejemplo:
 *   <ButtonLink href="/expedientes/nuevo" icon={<NexoIcon name="users" />}>Nuevo empleado</ButtonLink>
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  disabled = false,
  ...rest
}: ButtonLinkProps) {
  const classes = buttonClassName({ variant, size, fullWidth, disabled, className });
  if (disabled) {
    return (
      <span aria-disabled="true" className={classes}>
        {icon}
        {children}
      </span>
    );
  }
  return (
    <Link {...rest} className={classes}>
      {icon}
      {children}
    </Link>
  );
}
