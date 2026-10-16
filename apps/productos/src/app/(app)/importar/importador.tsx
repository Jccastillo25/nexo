"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSection, MetricCard, StatusBadge, useToast } from "@nexo/ui";
import {
  COLUMNAS_ERP,
  detectar,
  filaErp,
  leerConsolidado,
  leerPlantilla,
  type Aviso,
  type FilaImportacion,
  type Hoja,
} from "@/lib/importacion";
import type { ResultadoImportacion } from "@/lib/tipos";
import { exportarProductos, importarProductos } from "./actions";

interface Archivo {
  nombre: string;
  tipo: "plantilla" | "consolidado" | "desconocido";
  hoja: Hoja;
  fila: number;
}

// Reglas de limpieza de lib/importacion.ts, con ejemplos reales de los Excel del ERP (plan 14 §4).
const LIMPIEZA: [string, string][] = [
  ["Código con espacio al inicio (\" 001001021\")", "Lo guarda como 001001021"],
  ["Clase con número entre paréntesis (\"Construccion (004)\")", "Crea la clase con su número de 2 dígitos y guarda 004 como referencia del ERP"],
  ["Mismo tipo bajo varias clases", "Lo crea una vez dentro de cada clase"],
  ["Marca \".\" (sin marca)", "La deja vacía"],
  ["Costo de relleno (C$ 1.00 o vacío)", "Usa el costo real del Consolidado de productos"],
  ["Producto sin clase, tipo ni categoría", "Lo importa igual y queda en “Para revisar”"],
  ["ID del producto del ERP", "Lo conserva como ID de Nexo; los nuevos siguen desde el más alto + 1"],
];

const NOMBRES_CATALOGO: Record<keyof ResultadoImportacion["catalogos_nuevos"], string> = {
  clases: "clases",
  tipos: "tipos",
  categorias: "categorías",
  marcas: "marcas",
  unidades: "unidades",
  proveedores: "proveedores",
  cuentas: "cuentas contables",
  centros_costo: "centros de costo",
};

async function leerArchivo(file: File): Promise<Archivo> {
  const { readSheet } = await import("read-excel-file/browser");
  let hoja: Hoja;
  try {
    hoja = (await readSheet(file, "Productos")) as Hoja;
  } catch {
    hoja = (await readSheet(file)) as Hoja;
  }
  const { tipo, fila } = detectar(hoja);
  return { nombre: file.name, tipo, hoja, fila };
}

export default function Importador({ puedeImportar, puedeExportar }: { puedeImportar: boolean; puedeExportar: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [filas, setFilas] = useState<FilaImportacion[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [previa, setPrevia] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function elegir(lista: FileList | null) {
    if (!lista?.length) return;
    setError(null);
    setPrevia(null);
    setLeyendo(true);
    try {
      const leidos = await Promise.all([...lista].map(leerArchivo));
      const plantilla = leidos.find((a) => a.tipo === "plantilla");
      const consolidado = leidos.find((a) => a.tipo === "consolidado");
      setArchivos(leidos);
      if (!plantilla) {
        setFilas([]);
        setAvisos([]);
        setError("No encontré la plantilla de importación del ERP (la que tiene “Nombre del Producto / Servicio”).");
        return;
      }
      const costos = consolidado ? leerConsolidado(consolidado.hoja, consolidado.fila) : null;
      const r = leerPlantilla(plantilla.hoja, plantilla.fila, costos);
      setFilas(r.filas);
      setAvisos(r.avisos);
    } catch (e) {
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLeyendo(false);
    }
  }

  function revisar(confirmar: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await importarProductos(filas, confirmar);
      if (!res.ok || !res.data) {
        setError(res.message ?? "No se pudo procesar la importación.");
        return;
      }
      setPrevia(res.data);
      if (confirmar && res.data.confirmado) {
        show(`Importación lista: ${res.data.creados} creados, ${res.data.actualizados} actualizados.`, "success");
        router.refresh();
      }
    });
  }

  function exportar() {
    setError(null);
    startTransition(async () => {
      const res = await exportarProductos();
      if (!res.ok || !res.data) {
        setError(res.message ?? "No se pudo exportar.");
        return;
      }
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const datos = [
        COLUMNAS_ERP.map((h) => ({ value: h, fontWeight: "bold" as const })),
        ...res.data.map((p) => filaErp(p).map((v) => (v === null ? null : { value: v }))),
      ];
      await writeXlsxFile(datos, { sheet: "Productos" }).toFile(`Productos_Nexo_${new Date().toISOString().slice(0, 10)}.xlsx`);
      show(`Exportados ${res.data.length} productos.`, "success");
    });
  }

  const plantilla = archivos.find((a) => a.tipo === "plantilla");
  const consolidado = archivos.find((a) => a.tipo === "consolidado");
  const conId = filas.filter((f) => f.erp_id !== null).length;
  const avisosAgrupados = Object.entries(
    avisos.reduce<Record<string, Aviso[]>>((acc, a) => ((acc[a.mensaje] ??= []).push(a), acc), {})
  ).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="flex flex-col gap-6">
      {puedeImportar ? (
        <FormSection
          title="1. Archivos del ERP"
          description="Elige la plantilla de importación de productos y, si lo tienes, el Consolidado de productos (de ahí sale el costo real). Se cruzan por código."
        >
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600 hover:border-blue-400 hover:bg-blue-50/40">
            <span className="font-semibold text-blue-700">Elegir archivos .xlsx</span>
            <span className="text-xs text-neutral-500">Puedes elegir los dos a la vez. Nada se guarda hasta que confirmes.</span>
            <input type="file" accept=".xlsx" multiple className="sr-only" onChange={(e) => elegir(e.target.files)} />
          </label>
          {leyendo && <p className="text-sm text-neutral-500">Leyendo archivos…</p>}
          {archivos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {archivos.map((a) => (
                <li key={a.nombre} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <span className="min-w-0 break-all font-medium text-neutral-900">{a.nombre}</span>
                  {a.tipo === "plantilla" && <StatusBadge label="Plantilla de importación" tone="info" />}
                  {a.tipo === "consolidado" && <StatusBadge label="Consolidado (costos)" tone="info" />}
                  {a.tipo === "desconocido" && <StatusBadge label="No reconocido" tone="warning" />}
                </li>
              ))}
            </ul>
          )}
          {archivos.length === 0 && (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Lo que trae el Excel</th>
                    <th className="px-3 py-2">Lo que hace Nexo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {LIMPIEZA.map(([excel, nexo]) => (
                    <tr key={excel}>
                      <td className="px-3 py-2">{excel}</td>
                      <td className="px-3 py-2">{nexo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>
      ) : (
        <p className="rounded-md bg-neutral-200/60 px-3 py-2 text-sm text-neutral-700">
          Importar requiere “Importar productos”, “Editar costo” y “Editar datos fiscales”: la importación escribe todos esos datos.
        </p>
      )}

      {plantilla && filas.length > 0 && (
        <FormSection title="2. Lo que se leyó" description="Antes de tocar la base: limpieza aplicada y avisos para revisar después.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard label="Productos en la plantilla" value={filas.length} />
            <MetricCard label="Con ID del ERP" value={conId} hint="Conservan ese ID en Nexo" />
            <MetricCard label="Costo del consolidado" value={consolidado ? "Sí" : "No"} tone={consolidado ? "positive" : "warning"} hint={consolidado ? consolidado.nombre : "Se usará el costo de la plantilla"} />
          </div>
          {avisosAgrupados.length > 0 && (
            <div className="flex flex-col gap-2">
              {avisosAgrupados.map(([mensaje, lista]) => (
                <details key={mensaje} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <summary className="cursor-pointer">
                    <span className="mr-2 inline-block min-w-8 rounded bg-amber-50 px-1.5 text-center font-semibold tabular-nums text-amber-700">{lista.length}</span>
                    {mensaje}
                  </summary>
                  <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-neutral-600">
                    {lista.slice(0, 200).map((a, i) => (
                      <li key={`${a.codigo}-${i}`}>
                        {a.fila ? `Fila ${a.fila} · ` : ""}<span className="font-mono">{a.codigo}</span> {a.nombre}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
          <div>
            <button type="button" onClick={() => revisar(false)} disabled={isPending}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
              {isPending ? "Revisando…" : "Revisar en la base (vista previa)"}
            </button>
          </div>
        </FormSection>
      )}

      {previa && (
        <FormSection
          title={previa.confirmado ? "Importación confirmada" : "3. Vista previa de la base"}
          description={previa.confirmado ? "Los productos ya están en el catálogo." : "Esto es exactamente lo que pasaría. Todavía no se guardó nada."}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Nuevos" value={previa.creados} tone="positive" />
            <MetricCard label="Actualizados" value={previa.actualizados} hint="Mismo código ya existente" />
            <MetricCard label="Errores" value={previa.errores.length} tone={previa.errores.length ? "negative" : "positive"} />
            <MetricCard label="Siguiente ID" value={previa.siguiente_id} hint="Para productos creados en Nexo" />
          </div>
          <p className="text-sm text-neutral-600">
            Catálogos nuevos:{" "}
            {Object.entries(previa.catalogos_nuevos)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${NOMBRES_CATALOGO[k as keyof typeof NOMBRES_CATALOGO]}`)
              .join(", ") || "ninguno"}
            . Sin clasificación: {previa.sin_clasificacion}. Sin costo real: {previa.sin_costo}.
          </p>
          {previa.errores.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Corrige estos errores en el Excel y vuelve a elegir el archivo. Con errores no se importa nada.</p>
              <ul className="mt-2 max-h-56 overflow-y-auto text-xs">
                {previa.errores.map((er, i) => (
                  <li key={i}>Fila {er.fila} · <span className="font-mono">{er.codigo || "(sin código)"}</span>: {er.mensaje}</li>
                ))}
              </ul>
            </div>
          )}
          {!previa.confirmado && previa.errores.length === 0 && (
            <div>
              <button type="button" onClick={() => revisar(true)} disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {isPending ? "Importando…" : `Confirmar importación de ${previa.total} productos`}
              </button>
              <p className="mt-2 text-xs text-neutral-500">Todo o nada: si una fila falla, no se guarda ninguna.</p>
            </div>
          )}
        </FormSection>
      )}

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {puedeExportar && (
        <FormSection
          title="Exportar al ERP"
          description="Descarga el catálogo de Nexo con las columnas de la plantilla de importación del ERP. Precio, margen y descuentos van vacíos: se manejan en Listas de precios."
        >
          <div>
            <button type="button" onClick={exportar} disabled={isPending}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
              Descargar Excel para el ERP
            </button>
          </div>
        </FormSection>
      )}
    </div>
  );
}
