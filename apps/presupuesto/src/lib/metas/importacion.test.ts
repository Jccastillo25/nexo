// Pruebas del lector del Excel de AG Negocio: pnpm --filter nexo-presupuesto test
import { test } from "node:test";
import assert from "node:assert/strict";
import { analizar, detectarEncabezado, fecha, lotes, numero, siNo, type HojaLeida } from "./importacion.ts";

const HOY = "2026-10-18";
const tc = 36.6243;

test("numero acepta los formatos de AG Negocio", () => {
  assert.equal(numero(1605), 1605);
  assert.equal(numero("1,605.00"), 1605);
  assert.equal(numero("C$ 1,605.50"), 1605.5);
  assert.equal(numero("US$43.82"), 43.82);
  assert.equal(numero("$ 43.82"), 43.82);
  assert.equal(numero("(100)"), -100);
  assert.equal(numero("1.605,50"), 1605.5);
  assert.equal(numero("43,82"), 43.82);
  assert.equal(numero("12,500"), 12500);
  assert.equal(numero("C$ -100"), -100);
  assert.equal(numero("1.605"), 1605);
  assert.equal(numero("1.605.000"), 1605000);
  assert.equal(numero("43.8200"), 43.82);
  assert.equal(numero("-"), null);
  assert.equal(numero("abc"), null);
});

test("fecha acepta Date, serie de Excel y texto día/mes", () => {
  assert.equal(fecha(new Date(Date.UTC(2026, 8, 29))), "2026-09-29");
  assert.equal(fecha(46294), "2026-09-29");
  assert.equal(fecha("29/09/2026"), "2026-09-29");
  assert.equal(fecha("29-09-26"), "2026-09-29");
  assert.equal(fecha("2026-09-29 10:15"), "2026-09-29");
  assert.equal(fecha("31/02/2026"), null);
  assert.equal(fecha("Total"), null);
});

test("vencimiento imposible se descarta sin perder la venta (caso 52372-A, año 20233)", () => {
  // read-excel-file entrega un Date válido con año 20233; toISOString daría "+020233-08-03".
  const vencimientoMalo = new Date(Date.UTC(20233, 7, 3));
  assert.equal(fecha(vencimientoMalo), null);
  assert.equal(fecha(new Date(Date.UTC(1899, 0, 1))), null);
  const hoja: HojaLeida = {
    nombre: "2023",
    filas: [
      ["Fecha", "Fecha de vencimiento", "No Factura", "Cliente", "Anulada", "Total C$", "Total USD", "Vendedor"],
      [new Date(Date.UTC(2023, 6, 27)), vencimientoMalo, "52372-A", "Materiales El Lider", "No", 15099, 412.2672651763993, "002-Junieth   Zeledon"],
    ],
  };
  const r = analizar([hoja], { tipoCambio: tc, hoy: HOY });
  assert.equal(r.facturas.length, 1);
  assert.equal(r.facturas[0].fecha, "2023-07-27");
  assert.equal(r.facturas[0].vencimiento, null);
  assert.deepEqual(r.avisos.map((a) => a.tipo), ["vencimiento_invalido"]);
});

test("siNo reconoce anuladas", () => {
  assert.equal(siNo("Sí"), true);
  assert.equal(siNo("No"), false);
  assert.equal(siNo("ANULADA"), true);
  assert.equal(siNo(null), false);
});

test("detecta el encabezado debajo de títulos y descarta hojas que no son de facturas", () => {
  const ventas = [["MATERIALES J CASTILLO"], ["Reporte de ventas"], [], ["Fecha", "Fecha de vencimiento", "No Factura", "Cliente", "Anulada", "Total C$", "Total USD", "Vendedor"]];
  assert.equal(detectarEncabezado(ventas).fila, 3);
  const compras = [["Fecha", "Fecha Expiración", "No Factura", "Proveedor", "Anulada", "Total C$"]];
  assert.match(detectarEncabezado(compras).motivo ?? "", /compras/);
  const dashboard = [["DASHBOARD GENERAL"], ["Año", "Ventas Netas C$", "N° Facturas"]];
  assert.equal(detectarEncabezado(dashboard).fila, null);
});

test("analiza un Excel en bruto: títulos, totales, duplicados, anuladas, columnas faltantes", () => {
  const h2025: HojaLeida = {
    nombre: "2025",
    filas: [
      ["Ventas 2025"],
      ["Fecha", "Fecha de vencimiento", "No Factura", "Cliente", "Anulada", "Total C$", "Total USD", "Vendedor"],
      [new Date(Date.UTC(2025, 11, 31)), 46037, "83460-A", "Vario", "No", 1181, 32.2463, "004-Milagro   Carrillo"],
      [46022, 46037, "83459-A", "Vario", "Sí", "10,250.00", 279.8688, "004-Milagro   Carrillo"],
      ["", "", "", "", "", "11,431.00", 312.11, ""],
      ["Fecha", "Fecha de vencimiento", "No Factura", "Cliente", "Anulada", "Total C$", "Total USD", "Vendedor"],
      ["30/12/2025", "", "83458-A", "Ferretería", "No", 2720, 74.2676, ""],
      [null, null, null, null, null, null, null, null],
    ],
  };
  const h2026: HojaLeida = {
    nombre: "2026",
    filas: [
      ["Fecha", "No Factura", "Cliente", "Anulada", "Total C$", "Abono C$", "Saldo Pendiente C$", "Vendedor"],
      ["29/09/2026", "96825-A", "Vario", "No", 1605, 0, 0, "003-Julio Castillo"],
      ["31/12/2025", "83460-A", "Vario", "No", 1181, 0, 0, "004-Milagro Carrillo"],
      ["30/09/2026", "96826-A", "Vario", "No", 999, 0, 0, "003-Julio Castillo"],
      ["30/09/2026", "96826-A", "Vario", "No", 1000, 0, 0, "003-Julio Castillo"],
      ["15/12/2026", "99999-A", "Vario", "No", 10, 0, 0, "003-Julio Castillo"],
      ["TOTAL", "", "", "", 2604, "", "", ""],
    ],
  };
  const compras: HojaLeida = { nombre: "compras", filas: [["Fecha", "No Factura", "Proveedor", "Total C$"], [46249, "1128", "Durock", 65000]] };

  const r = analizar([h2025, h2026, compras], { tipoCambio: tc, hoy: HOY });
  assert.deepEqual(r.hojas.map((h) => [h.nombre, h.reconocida]), [["2025", true], ["2026", true], ["compras", false]]);

  const numeros = r.facturas.map((f) => f.numero);
  assert.deepEqual(numeros, ["83459-A", "83460-A", "96825-A", "96826-A"]);
  const tipos = r.avisos.map((a) => a.tipo).sort();
  assert.deepEqual(tipos, ["duplicada_distinta", "duplicada_igual", "fecha_futura", "resumen", "resumen", "sin_vendedor", "usd_calculado", "usd_calculado", "usd_calculado", "usd_calculado"].sort());

  const anulada = r.facturas.find((f) => f.numero === "83459-A")!;
  assert.equal(anulada.anulada, true);
  assert.equal(anulada.total_cs, 10250);
  const ultima = r.facturas.find((f) => f.numero === "96826-A")!;
  assert.equal(ultima.total_cs, 1000);
  assert.equal(ultima.total_usd, Math.round((1000 / tc) * 10000) / 10000);

  assert.deepEqual(r.porAnio.map((a) => [a.anio, a.facturas, a.anuladas]), [[2025, 1, 1], [2026, 2, 0]]);
  assert.equal(r.tipoCambioDetectado !== null && Math.abs(r.tipoCambioDetectado - tc) < 0.01, true);
  assert.equal(r.fechaMax, "2026-09-30");
});

test("total único con columna Moneda", () => {
  const r = analizar([{ nombre: "x", filas: [
    ["Fecha", "Factura", "Moneda", "Total", "Tipo de cambio", "Vendedor"],
    ["01/10/2026", "A1", "USD", 100, 36.5, "001-Ana"],
    ["01/10/2026", "A2", "C$", 3650, 36.5, "001-Ana"],
  ] }], { tipoCambio: tc, hoy: HOY });
  assert.deepEqual(r.facturas.map((f) => [f.numero, f.total_cs, f.total_usd]), [["A1", 3650, 100], ["A2", 3650, 100]]);
});

test("0 en la columna de la otra moneda se calcula con el tipo de cambio (reporte 20-10-2026)", () => {
  const r = analizar([{ nombre: "Consolidado Facturas", filas: [
    ["Fecha", "No Factura", "Anulada", "Sub Total C$", "Sub Total USD", "Total C$", "Total USD", "Vendedor"],
    ["20/10/2026", "97578-A", "No", 3662.43, 0, 3662.43, 0, "011-Alvaro Vega"],
    ["16/10/2026", "1694-B", "No", 0, 100, 0, 100, "003-Julio Castillo"],
    ["16/10/2026", "C3", "Sí", 0, 0, 0, 0, "003-Julio Castillo"],
    ["16/10/2026", "D4", "No", -366.243, 0, -366.243, 0, "003-Julio Castillo"],
  ] }], { tipoCambio: tc, hoy: HOY });
  const porNumero = Object.fromEntries(r.facturas.map((f) => [f.numero, [f.total_cs, f.total_usd]]));
  assert.deepEqual(porNumero, { "97578-A": [3662.43, 100], "1694-B": [3662.43, 100], C3: [0, 0], D4: [-366.24, -10] });
  assert.deepEqual(r.avisos.map((a) => a.tipo).sort(), ["cs_calculado", "usd_calculado", "usd_calculado"]);
});

test("anulada sin total se guarda en 0; no anulada sin total se ignora", () => {
  const r = analizar([{ nombre: "x", filas: [
    ["Fecha", "No Factura", "Anulada", "Total C$", "Total USD", "Vendedor"],
    ["01/10/2026", "B1", "Sí", "", "", "001-Ana"],
    ["01/10/2026", "B2", "No", "", "", "001-Ana"],
  ] }], { tipoCambio: tc, hoy: HOY });
  assert.deepEqual(r.facturas.map((f) => [f.numero, f.anulada, f.total_cs, f.total_usd]), [["B1", true, 0, 0]]);
  assert.deepEqual(r.avisos.map((a) => a.tipo).sort(), ["anulada_sin_total", "sin_total"]);
});

test("subtotales con fecha y vendedor no se importan; Factura No. y mayúsculas", () => {
  const r = analizar([{ nombre: "x", filas: [
    ["Fecha", "Factura No.", "Cliente", "Total C$", "Total USD", "Vendedor"],
    ["29/09/2026", "Total", "", 5000, 136.5, "001-Ana"],
    ["29/09/2026", "Subtotal 001", "", 5000, 136.5, "001-Ana"],
    ["29/09/2026", "", "", 5000, 136.5, "Total 001-Ana"],
    ["29/09/2026", "c1-a", "Totales S.A.", 3662.43, 100, "001-Ana"],
  ] }], { tipoCambio: tc, hoy: HOY });
  assert.deepEqual(r.facturas.map((f) => [f.numero, f.cliente]), [["C1-A", "Totales S.A."]]);
  assert.deepEqual(r.avisos.map((a) => a.tipo), ["resumen", "resumen", "resumen"]);
});

test("lotes de 1000", () => {
  const l = lotes(Array.from({ length: 2501 }, (_, i) => i));
  assert.deepEqual(l.map((x) => x.length), [1000, 1000, 501]);
});
