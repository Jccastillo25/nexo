import type { NextRequest } from "next/server";
import { MENSAJE_GENERICO } from "@nexo/permissions";
import { P } from "@/lib/permisos-rrhh";
import { aCsv, respuestaCsv, type CeldaCsv } from "@/lib/planilla/csv";
import { REGIMEN, etiqueta } from "@/lib/planilla/etiquetas";
import { num, sumarMontos } from "@/lib/planilla/formato";
import { esUuid } from "@/lib/planilla/rutas";
import { exigirEnRuta, respuestaError } from "@/lib/planilla/servidor";
import type { Linea, TipoConcepto } from "@/lib/planilla/tipos";
import { detallePlanilla } from "../../datos";

export const dynamic = "force-dynamic";

/** Orden de las columnas de conceptos: ingresos, deducciones, aportes y provisiones. */
const ORDEN_TIPO: Record<TipoConcepto, number> = { devengado: 0, deduccion: 1, aporte_patronal: 2, provision: 3 };

interface ColumnaConcepto {
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  orden: number;
}

/**
 * GET /rrhh/planillas/periodos/<id>/exportar — CSV de revisión de la
 * planilla (B11): una fila por persona y una columna por concepto ("CODIGO ·
 * Nombre", con el monto de la línea o vacío), y al final los totales del
 * renglón. Es un pivoteo de `planilla_detalle`: los montos son los de la RPC
 * (si un concepto tiene varias líneas en un renglón, se suman con
 * `sumarMontos`, en centavos).
 *
 * Endpoint público: valida sesión, `rrhh.ver_modulo`, planilla.ver y
 * reportes.exportar en el servidor (exigirEnRuta, requirePermission) antes
 * de leer; la RPC vuelve a validar planilla.ver. Errores en JSON
 * `{ message }`: 401, 403, 404, 409 (borrador) y 500.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/planillas/periodos/[id]/exportar">) {
  const { id } = await ctx.params;
  if (!esUuid(id)) return respuestaError(404, "Esa planilla no existe.");

  const acceso = await exigirEnRuta([P.planillaVer, P.planillaExportar], {
    sinPermiso: "No tienes permiso para exportar planillas.",
  });
  if (!acceso.ok) return acceso.respuesta;

  const d = await detallePlanilla(acceso.ctx, id);
  if (d === "no-encontrada") return respuestaError(404, "Esa planilla no existe.");
  if (!d.ok) {
    if (d.motivo === "denegado") return respuestaError(403, "No tienes permiso para exportar planillas.");
    if (d.motivo === "negocio") return respuestaError(400, d.mensaje);
    return respuestaError(500, MENSAJE_GENERICO);
  }

  const { planilla: p, renglones } = d.valor;
  if (p.estado === "borrador") return respuestaError(409, "Calcula la planilla antes de exportarla.");

  // Columnas de conceptos: las que aparecen en algún renglón, por tipo y orden.
  const porCodigo = new Map<string, ColumnaConcepto>();
  for (const rg of renglones) {
    for (const l of rg.lineas) {
      const actual = porCodigo.get(l.concepto_codigo);
      if (!actual) {
        porCodigo.set(l.concepto_codigo, { codigo: l.concepto_codigo, nombre: l.concepto_nombre, tipo: l.tipo, orden: l.orden });
      } else if (l.orden < actual.orden) {
        actual.orden = l.orden;
      }
    }
  }
  const conceptos = [...porCodigo.values()].sort(
    (a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9) || a.orden - b.orden || a.codigo.localeCompare(b.codigo)
  );

  const encabezados = [
    "N.º contrato",
    "Persona",
    "Régimen",
    "Días pagados",
    "Salario mensual",
    ...conceptos.map((c) => `${c.codigo} · ${c.nombre}`),
    "Devengado",
    "Deducciones",
    "Neto",
    "Aportes patronales",
    "Provisiones",
  ];

  const filas: CeldaCsv[][] = renglones.map((rg) => {
    const lineasPorCodigo = new Map<string, Linea[]>();
    for (const l of rg.lineas) {
      const lista = lineasPorCodigo.get(l.concepto_codigo);
      if (lista) lista.push(l);
      else lineasPorCodigo.set(l.concepto_codigo, [l]);
    }
    return [
      num(rg.numero_contrato),
      rg.empleado_nombre,
      etiqueta(REGIMEN, rg.regimen),
      num(rg.dias_pagados),
      num(rg.salario_mensual),
      ...conceptos.map((c) => {
        const lineas = lineasPorCodigo.get(c.codigo);
        if (!lineas) return null;
        return lineas.length === 1 ? num(lineas[0].monto) : sumarMontos(lineas.map((l) => l.monto));
      }),
      num(rg.devengado),
      num(rg.deducciones),
      num(rg.neto),
      num(rg.aportes),
      num(rg.provisiones),
    ];
  });

  return respuestaCsv(`planilla-${p.periodo_inicio}-${p.periodo_fin}.csv`, aCsv(encabezados, filas));
}
