// Pruebas del ritmo del mes: pnpm --filter nexo-presupuesto test
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRitmo, proyectar, variacion } from "./ritmo.ts";
import { diaDeCorte, serieAcumulada } from "./acumulado.ts";
import { UMBRAL_RIESGO, estadoCumplimiento, mesPosteriorAlCorte } from "./formato.ts";

test("un solo umbral de riesgo para el cumplimiento", () => {
  assert.equal(UMBRAL_RIESGO, 0.9);
  assert.equal(estadoCumplimiento(1).tone, "positive");
  assert.equal(estadoCumplimiento(0.9).tone, "warning");
  assert.equal(estadoCumplimiento(0.89).tone, "negative");
  assert.equal(estadoCumplimiento(null).tone, "neutral");
});

test("mes posterior al corte: la meta acumulada no se compara", () => {
  assert.equal(mesPosteriorAlCorte("2026-10-20", 2026, 10), false);
  assert.equal(mesPosteriorAlCorte("2026-10-20", 2026, 9), false);
  assert.equal(mesPosteriorAlCorte("2026-10-20", 2026, 11), true);
  assert.equal(mesPosteriorAlCorte("2025-12-31", 2026, 1), true);
  assert.equal(mesPosteriorAlCorte(null, 2026, 1), true);
});

test("serie acumulada: real hasta el corte, ritmo por días hábiles y año anterior", () => {
  const dias = [
    { dia: 1, habil: true, usd: 10, usd_anterior: 5 },
    { dia: 2, habil: false, usd: 0, usd_anterior: 1 },
    { dia: 3, habil: true, usd: 20, usd_anterior: 5 },
    { dia: 4, habil: true, usd: 30, usd_anterior: 5 },
  ];
  const s = serieAcumulada(dias, 300, 3);
  assert.deepEqual(s.map((p) => p.real), [10, 10, 30, null]);
  assert.deepEqual(s.map((p) => p.esperado), [100, 100, 200, 300]);
  assert.deepEqual(s.map((p) => p.anterior), [5, 6, 11, 16]);
  assert.deepEqual(serieAcumulada(dias, null, 4).map((p) => p.esperado), [null, null, null, null]);
});

test("día de corte dentro, antes y después del mes", () => {
  assert.equal(diaDeCorte("2026-10-20", 2026, 10, 31), 20);
  assert.equal(diaDeCorte("2026-09-30", 2026, 10, 31), 0);
  assert.equal(diaDeCorte("2026-11-02", 2026, 10, 31), 31);
  assert.equal(diaDeCorte(null, 2026, 10, 31), 0);
});

test("mes en curso: proyecta al ritmo actual y calcula lo que falta por día", () => {
  // 10 de 26 días hábiles, 40,000 vendidos de una meta de 100,000.
  const r = calcularRitmo(40_000, 100_000, 26, 10);
  assert.equal(r.estado, "en_curso");
  assert.equal(r.proyeccion, 104_000);
  assert.equal(r.fraccionProyectada, 1.04);
  assert.equal(r.requeridoPorDia, 60_000 / 16);
  assert.equal(r.promedioDiario, 4_000);
  assert.ok(Math.abs((r.fraccionALaFecha ?? 0) - 1.04) < 1e-9);
  assert.equal(r.diasRestantes, 16);
});

test("meta ya cumplida: no pide más por día", () => {
  const r = calcularRitmo(120, 100, 26, 20);
  assert.equal(r.requeridoPorDia, 0);
});

test("mes cerrado: la proyección es lo vendido", () => {
  const r = calcularRitmo(90, 100, 26, 26);
  assert.equal(r.estado, "cerrado");
  assert.equal(r.proyeccion, 90);
  assert.equal(r.requeridoPorDia, null);
  assert.equal(r.diasRestantes, 0);
});

test("sin facturas del mes todavía: sin proyección y la meta se reparte en todos los días", () => {
  const r = calcularRitmo(0, 2_600, 26, 0);
  assert.equal(r.estado, "sin_datos");
  assert.equal(r.proyeccion, null);
  assert.equal(r.fraccionProyectada, null);
  assert.equal(r.requeridoPorDia, 100);
  assert.equal(r.fraccionALaFecha, null);
});

test("sin meta: proyecta pero no calcula cumplimiento", () => {
  const r = calcularRitmo(50, null, 20, 10);
  assert.equal(r.proyeccion, 100);
  assert.equal(r.fraccionProyectada, null);
  assert.equal(r.requeridoPorDia, null);
  assert.equal(calcularRitmo(50, 0, 20, 10).fraccionProyectada, null);
});

test("días transcurridos fuera de rango se acotan", () => {
  assert.equal(calcularRitmo(10, 100, 26, 40).estado, "cerrado");
  assert.equal(calcularRitmo(10, 100, 26, -3).estado, "sin_datos");
  assert.equal(proyectar(10, 0, 0), null);
});

test("variación contra el año anterior", () => {
  assert.equal(variacion(150, 100), 0.5);
  assert.equal(variacion(50, 100), -0.5);
  assert.equal(variacion(50, 0), null);
  assert.equal(variacion(50, null), null);
});
