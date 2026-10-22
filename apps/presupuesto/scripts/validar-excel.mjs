// Revisa un Excel de facturas de AG Negocio SIN tocar la base: muestra qué hojas se
// reconocen, cuántas facturas salen por año y por vendedor, y qué filas se
// ignoran y por qué. Usa el mismo lector que la pantalla Importar.
//
//   pnpm --filter nexo-presupuesto validar-excel -- "C:\ruta\archivo.xlsx" [--tc 36.6243] [--json salida.json]
//
// --json guarda las filas listas para public.presupuesto_importar_facturas.
import { writeFileSync } from "node:fs";
import readXlsxFile from "read-excel-file/node";
import { AVISOS, TIPO_CAMBIO_POR_DEFECTO, agruparAvisos, analizar } from "../src/lib/metas/importacion.ts";

const args = process.argv.slice(2).filter((a) => a !== "--");
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
// El archivo es el primer argumento que no es una bandera ni el valor de una.
const archivo = args.find((a, i) => !a.startsWith("--") && !["--tc", "--json"].includes(args[i - 1]));
if (!archivo) {
  console.error('Uso: validar-excel "archivo.xlsx" [--tc 36.6243] [--json salida.json]');
  process.exit(1);
}
const tipoCambio = Number(valor("--tc") ?? TIPO_CAMBIO_POR_DEFECTO);

const inicio = Date.now();
const hojas = (await readXlsxFile(archivo)).map((h) => ({ nombre: h.sheet, filas: h.data }));
const leido = Date.now();
const r = analizar(hojas, { tipoCambio });
const fmt = (n, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

console.log(`\nArchivo: ${archivo}`);
console.log(`Leído en ${((leido - inicio) / 1000).toFixed(1)} s, analizado en ${((Date.now() - leido) / 1000).toFixed(1)} s.`);
console.log(`Tipo de cambio usado cuando falta un total: ${tipoCambio}. Detectado en el archivo: ${r.tipoCambioDetectado ?? "—"}.\n`);

console.log("HOJAS");
for (const h of r.hojas) {
  if (h.reconocida) {
    const cols = Object.entries(h.columnas).map(([k, v]) => `${k}="${v}"`).join(", ");
    console.log(`  ✔ ${h.nombre}: ${h.facturas} facturas (encabezado en la fila ${h.filaEncabezado}; ${cols})`);
  } else {
    console.log(`  ✘ ${h.nombre}: ${h.motivo}`);
  }
}

console.log(`\nFACTURAS A IMPORTAR: ${r.facturas.length} (${r.fechaMin ?? "—"} a ${r.fechaMax ?? "—"})`);
console.log("\nPOR AÑO (sin anuladas)");
for (const a of r.porAnio) {
  console.log(`  ${a.anio}: ${a.facturas} facturas · C$ ${fmt(a.total_cs)} · US$ ${fmt(a.total_usd)} · ${a.anuladas} anuladas`);
}
console.log("\nPOR VENDEDOR (sin anuladas)");
for (const v of r.porVendedor) {
  console.log(`  ${v.vendedor.padEnd(32)} ${String(v.facturas).padStart(6)} facturas · US$ ${fmt(v.total_usd).padStart(15)} · ${v.primera} a ${v.ultima}`);
}

const grupos = agruparAvisos(r.avisos);
console.log(grupos.length ? "\nAVISOS" : "\nSin avisos.");
for (const g of grupos) {
  console.log(`  ${String(g.lista.length).padStart(6)}  ${g.mensaje}`);
  for (const a of g.lista.slice(0, 5)) {
    console.log(`          ${a.hoja}, fila ${a.fila}${a.numero ? ` (${a.numero})` : ""}${a.detalle ? `: ${a.detalle}` : ""}`);
  }
}
const ignoradas = r.avisos.filter((a) => !AVISOS[a.tipo].seImporta).length;
console.log(`\nFilas que no se importan: ${ignoradas}.`);

const salida = valor("--json");
if (salida) {
  writeFileSync(salida, JSON.stringify(r.facturas));
  console.log(`Filas guardadas en ${salida}.`);
}
