/**
 * Documento de un reporte listo para exportar (PDF o vista de impresión):
 * mismo encabezado, tabla, totales y pie en ambos formatos.
 */
import {
  describirFiltros,
  fechaHoraManagua,
  INFO_REPORTE,
  NOTA_SIN_MARCAS,
  NOTA_SOBRE_JORNADA,
  periodo,
} from "./formato";
import { tablaDe, totalesDe, type Tabla, type Total } from "./tabla";
import type { DatosReporte, Emision, FiltrosReporte, OpcionesReporte, Reporte } from "./tipos";

export type DocumentoReporte = {
  reporte: Reporte;
  titulo: string;
  orientacion: "landscape" | "portrait";
  empresa: string;
  empresaRuc: string | null;
  periodo: string;
  filtros: string[];
  /** Solo tarjeta: persona, contrato, departamento, puesto, jornada. */
  ficha: { label: string; valor: string }[];
  tabla: Tabla;
  totales: Total[];
  notas: string[];
  /** "Emitido el dd/mm/aaaa HH:mm por <usuario>" */
  emitido: string;
  firmas: boolean;
};

function unicos(valores: (string | null | undefined)[]): string {
  const lista = [...new Set(valores.filter((v): v is string => Boolean(v)))];
  return lista.length > 0 ? lista.join(", ") : "—";
}

export function armarDocumento(args: {
  datos: DatosReporte;
  filtros: FiltrosReporte;
  opciones: OpcionesReporte | null;
  emision: Emision;
}): DocumentoReporte {
  const { datos, filtros, opciones, emision } = args;
  const reporte = datos.reporte;
  const info = INFO_REPORTE[reporte];

  let ficha: DocumentoReporte["ficha"] = [];
  if (datos.reporte === "tarjeta") {
    const empleado = opciones?.empleados.find((e) => e.id === filtros.empleadoId);
    const contrato = empleado?.contratos?.find((c) => c.id === filtros.contratoId);
    const primera = datos.filas[0];
    ficha = [
      { label: "Persona", valor: empleado?.label ?? (primera ? `${primera.empleado_nombre} (${primera.empleado_codigo})` : "—") },
      { label: "Contrato", valor: contrato ? `N.º ${contrato.numero}` : primera ? `N.º ${primera.contrato_numero}` : "—" },
      { label: "Departamento", valor: unicos(datos.filas.map((f) => f.departamento)) },
      { label: "Puesto", valor: unicos(datos.filas.map((f) => f.puesto)) },
      { label: "Jornada", valor: unicos(datos.filas.map((f) => f.jornada_nombre)) },
    ];
  }

  const notas: string[] = [];
  if (reporte !== "tardanzas") notas.push(NOTA_SIN_MARCAS);
  if (reporte === "resumen") notas.push(NOTA_SOBRE_JORNADA);

  return {
    reporte,
    titulo: info.titulo,
    orientacion: info.orientacion,
    empresa: emision.empresa ?? "Empresa",
    empresaRuc: emision.empresa_ruc,
    periodo: periodo(filtros.desde, filtros.hasta),
    filtros: reporte === "tarjeta" ? [] : describirFiltros(reporte, filtros, opciones),
    ficha,
    tabla: tablaDe(datos),
    totales: totalesDe(reporte, datos.totales, datos.total),
    notas,
    emitido: `Emitido el ${fechaHoraManagua(emision.emitido_en)} por ${emision.emitido_por ?? "usuario sin nombre"}`,
    firmas: reporte === "tarjeta",
  };
}
