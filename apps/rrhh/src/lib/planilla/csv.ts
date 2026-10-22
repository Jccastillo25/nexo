/**
 * CSV de revisión de Planilla (planilla por persona, declaraciones). Módulo
 * PURO: arma el texto y la respuesta HTTP; los datos y los permisos los
 * resuelve el Route Handler antes de llamar aquí.
 *
 * Formato: BOM UTF-8 (Excel reconoce las tildes), separador coma, fin de
 * línea CRLF, comillas solo cuando hacen falta (coma, comilla, salto de línea
 * o espacios al borde) y `"` → `""`. Números con punto decimal y sin
 * separador de miles; null/undefined → celda vacía.
 *
 * Inyección de fórmulas (CSV injection): un TEXTO que empieza con `=`, `+`,
 * `-`, `@`, tabulador o retorno de carro se antepone con `'` para que la hoja
 * de cálculo no lo ejecute. Por eso los montos van como `number`, no como
 * texto: un número negativo nunca se altera.
 */

export type CeldaCsv = string | number | boolean | null | undefined;

const BOM = "﻿";
const FIN_LINEA = "\r\n";
const INICIO_PELIGROSO = /^[=+\-@\t\r]/;
const NECESITA_COMILLAS = /[",\r\n]|^\s|\s$/;

/** Una celda ya protegida y entrecomillada si hace falta. */
export function celdaCsv(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  let texto = valor;
  if (INICIO_PELIGROSO.test(texto)) texto = `'${texto}`;
  return NECESITA_COMILLAS.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV completo con BOM: una fila de encabezados y una por cada elemento de `filas`. */
export function aCsv(encabezados: readonly string[], filas: readonly (readonly CeldaCsv[])[]): string {
  const lineas = [encabezados.map(celdaCsv).join(","), ...filas.map((fila) => fila.map(celdaCsv).join(","))];
  return BOM + lineas.join(FIN_LINEA) + FIN_LINEA;
}

/** Nombre de archivo seguro para Content-Disposition (solo letras, números, punto, guion y guion bajo). */
export function nombreArchivoCsv(nombre: string): string {
  const limpio = nombre.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const base = limpio || "exportacion";
  return base.toLowerCase().endsWith(".csv") ? base : `${base}.csv`;
}

/** Respuesta de descarga del CSV: text/csv UTF-8, adjunto y sin caché. */
export function respuestaCsv(nombre: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivoCsv(nombre)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
