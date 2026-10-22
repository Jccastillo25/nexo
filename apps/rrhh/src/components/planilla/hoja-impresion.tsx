import type { ReactNode } from "react";
import Link from "next/link";
import { fechaHora } from "@nexo/ui";
import BotonImprimir from "@/app/(impresion)/asistencia/imprimir/[reporte]/boton-imprimir";
import type { Empresa } from "@/lib/planilla/tipos";

/** "Emitido el 21/10/2026, 9:05 a. m. en Nexo" (hora de Managua). */
export function textoEmision(momento: Date | string = new Date()): string {
  return `Emitido el ${fechaHora(momento)} en Nexo`;
}

const CLASE_ENLACE =
  "rounded-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/** Empresa, RUC, título y subtítulo de un documento impreso. */
export function EncabezadoImpresion({
  empresa,
  titulo,
  subtitulo,
  nivel = "h1",
}: {
  empresa?: Empresa | null;
  titulo: string;
  subtitulo?: ReactNode;
  /** h1 una vez por documento; h2 si cada página repite su encabezado (colillas). */
  nivel?: "h1" | "h2";
}) {
  const Titulo = nivel;
  return (
    <header className="flex flex-col gap-1">
      {empresa ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-neutral-900">{empresa.nombre}</p>
          {empresa.ruc ? <p className="text-xs text-neutral-600">RUC {empresa.ruc}</p> : null}
        </div>
      ) : null}
      <Titulo className="text-xl font-semibold text-neutral-900 print:text-[15pt]">{titulo}</Titulo>
      {subtitulo ? <div className="text-neutral-700">{subtitulo}</div> : null}
    </header>
  );
}

/** Pie "Emitido el …" de una página o documento. */
export function PieImpresion({ texto }: { texto: string }) {
  return <footer className="mt-4 border-t border-neutral-200 pt-2 text-xs text-neutral-500">{texto}</footer>;
}

/**
 * Una página impresa (p. ej. una colilla por persona): salto de página
 * después de cada una, salvo la última (`section` hermanas; un pie que venga
 * después queda en la misma hoja que la última).
 */
export function PaginaImpresion({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <section
      {...rest}
      className={`flex flex-col gap-4 break-after-page last-of-type:break-after-auto ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

/**
 * Marco de las vistas de impresión de Planilla (colillas, detalle para
 * cheques, liquidación), dentro del grupo (impresion-planilla), sin
 * NexoShell:
 * - `@page` A4 vertical u horizontal, con solo "Página n de m" en el margen
 *   (el "Emitido el …" va una vez, en el pie del documento o de cada colilla);
 * - barra que no se imprime: "Volver" (next/link) + Imprimir;
 * - encabezado (empresa, RUC, título, subtítulo) y pie "Emitido el …".
 *
 * Con `encabezado={false}` cada página trae el suyo (EncabezadoImpresion con
 * nivel "h2" dentro de PaginaImpresion) y aquí queda solo el h1 oculto.
 */
export function HojaImpresion({
  titulo,
  subtitulo,
  empresa,
  orientacion = "vertical",
  volver,
  emitido,
  encabezado = true,
  children,
}: {
  /** Título del documento ("Colilla de pago", "Detalle para cheques", "Liquidación final"). */
  titulo: string;
  subtitulo?: ReactNode;
  empresa?: Empresa | null;
  orientacion?: "vertical" | "horizontal";
  /** Ruta interna (sin basePath) de la pantalla de origen. */
  volver: { href: string; label: string };
  /** Texto de emisión; por defecto "Emitido el {ahora} en Nexo". */
  emitido?: string;
  encabezado?: boolean;
  children: ReactNode;
}) {
  const textoEmitido = emitido ?? textoEmision();
  const tamano = orientacion === "horizontal" ? "A4 landscape" : "A4 portrait";
  const css = `
@page {
  size: ${tamano};
  margin: 12mm 12mm 16mm 12mm;
  @bottom-left { content: "Página " counter(page) " de " counter(pages); font-size: 8pt; }
}
@media print {
  html, body { background: white !important; }
}`;

  return (
    <>
      <style>{css}</style>
      <main
        className={`mx-auto flex w-full flex-col gap-4 px-6 py-6 text-sm print:max-w-none print:p-0 print:text-[9pt] ${
          orientacion === "horizontal" ? "max-w-6xl" : "max-w-4xl"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 print:hidden">
          <Link href={volver.href} className={CLASE_ENLACE}>
            {volver.label}
          </Link>
          <BotonImprimir />
        </div>

        {encabezado ? (
          <EncabezadoImpresion empresa={empresa} titulo={titulo} subtitulo={subtitulo} />
        ) : (
          <h1 className="sr-only">{titulo}</h1>
        )}

        {children}

        {encabezado ? <PieImpresion texto={textoEmitido} /> : null}
      </main>
    </>
  );
}
