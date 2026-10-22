"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  ButtonLink,
  ConfirmDialog,
  DataTable,
  Field,
  FormSection,
  Input,
  MetricCard,
  Spinner,
  StatusBadge,
  entero,
  fechaCorta,
  useToast,
  type DataTableColumn,
} from "@nexo/ui";
import {
  agruparAvisos,
  lotes,
  TIPO_CAMBIO_POR_DEFECTO,
  type Analisis,
  type Celda,
  type FilaFactura,
  type HojaLeida,
  type ResumenAnual,
  type ResumenVendedor,
} from "@/lib/metas/importacion";
import { cs, duracion, leerNumero, usd } from "@/lib/metas/formato";
import { hoyManagua } from "@/lib/metas/periodo";
import type { ErrorFila } from "@/lib/metas/tipos";
import { crearAnalizador, type Analizador } from "./analizador";
import { importarLote, terminarImportacion } from "./actions";

const TAMANO_LOTE = 1000;
const MAX_ERRORES_EN_PANTALLA = 500;
const MAX_EJEMPLOS = 200;

type Etapa = "inicio" | "leyendo" | "analizado" | "enviando" | "pausado" | "terminado";
type Modo = "comprobar" | "importar";

interface Lectura {
  archivo: string;
  analisis: Analisis;
  /** `${fila}|${NÚMERO}` → hoja de origen, para ubicar cada error en el Excel. */
  origen: Map<string, string>;
}

interface Acumulado {
  importacionId: string | null;
  procesadas: number;
  nuevas: number;
  actualizadas: number;
  vendedoresNuevos: number;
  errores: ErrorFila[];
  fechaMin: string | null;
  fechaMax: string | null;
}

interface Final {
  modo: Modo;
  detenido: boolean;
  /** Lote (1-based) en el que se detuvo. */
  lote: number;
  totalLotes: number;
  mensaje: string | null;
  acumulado: Acumulado;
  duracionMs: number;
}

const ACUMULADO_VACIO: Acumulado = {
  importacionId: null,
  procesadas: 0,
  nuevas: 0,
  actualizadas: 0,
  vendedoresNuevos: 0,
  errores: [],
  fechaMin: null,
  fechaMax: null,
};

/** Código del vendedor como lo deriva la RPC: "001-Edith  Saballo" → "001". */
function codigoVendedor(raw: string): string {
  const v = raw.replace(/\s+/g, " ").trim();
  const codigo = /^[^-]+-.+$/.test(v) ? v.split("-")[0].trim() : v;
  return codigo.slice(0, 40).toLowerCase();
}

const menor = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const mayor = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const rango = (min: string | null, max: string | null) => (min && max ? `${fechaCorta(min)} – ${fechaCorta(max)}` : "—");

/** Fila de la tabla por año: los años del archivo y, si hay más de uno, el total. */
type FilaAnio = ResumenAnual & { esTotal?: boolean };

/** Celda de la fila Total en negrita. */
const negrita = (fila: FilaAnio, valor: string | number) =>
  fila.esTotal ? <span className="font-semibold text-neutral-900">{valor}</span> : valor;

const COLUMNAS_ANIO: DataTableColumn<FilaAnio>[] = [
  { key: "anio", header: "Año", render: (x) => <span className="font-medium text-neutral-900">{x.esTotal ? "Total" : x.anio}</span> },
  { key: "facturas", header: "Facturas", numeric: true, render: (x) => negrita(x, entero(x.facturas)) },
  { key: "anuladas", header: "Anuladas", numeric: true, render: (x) => negrita(x, entero(x.anuladas)) },
  { key: "usd", header: "US$", numeric: true, className: "whitespace-nowrap", render: (x) => negrita(x, usd(x.total_usd)) },
  { key: "cs", header: "C$", numeric: true, className: "whitespace-nowrap", render: (x) => negrita(x, cs(x.total_cs)) },
];

/** Columnas de la tabla por vendedor; `existentes` marca los que se crearían al importar. */
function columnasVendedor(existentes: Set<string> | null): DataTableColumn<ResumenVendedor>[] {
  return [
    {
      key: "vendedor",
      header: "Vendedor",
      render: (v) => (
        <>
          <span className="font-medium text-neutral-900">{v.vendedor}</span>{" "}
          {existentes && !existentes.has(codigoVendedor(v.vendedor)) ? <StatusBadge label="Nuevo" tone="info" /> : null}
        </>
      ),
    },
    { key: "facturas", header: "Facturas", numeric: true, render: (v) => entero(v.facturas) },
    { key: "usd", header: "US$", numeric: true, className: "whitespace-nowrap", render: (v) => usd(v.total_usd) },
    {
      key: "rango",
      header: "Primera – última",
      className: "whitespace-nowrap tabular-nums text-neutral-600",
      render: (v) => rango(v.primera, v.ultima),
    },
  ];
}

/** Fila con error, con su posición (la misma fila del Excel puede repetirse entre hojas). */
type FilaError = ErrorFila & { indice: number };

/** Columnas de las filas con error que devuelve la base. */
function columnasErrores(ubicar: (e: ErrorFila) => string): DataTableColumn<FilaError>[] {
  return [
    { key: "hoja", header: "Hoja", render: (e) => ubicar(e) },
    { key: "fila", header: "Fila", numeric: true, render: (e) => e.fila },
    { key: "numero", header: "N.º", render: (e) => <span className="font-mono text-xs">{e.numero || "—"}</span> },
    { key: "motivo", header: "Motivo", render: (e) => e.error },
  ];
}

export default function Importador({
  codigosExistentes,
  puedeVincular,
  puedeVerEquipo,
}: {
  codigosExistentes: string[] | null;
  puedeVincular: boolean;
  puedeVerEquipo: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const idArchivo = useId();

  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [mensajeOcupado, setMensajeOcupado] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [tcTexto, setTcTexto] = useState(String(TIPO_CAMBIO_POR_DEFECTO));
  const [tcUsado, setTcUsado] = useState(TIPO_CAMBIO_POR_DEFECTO);
  const [errorTc, setErrorTc] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>("importar");
  const [loteActual, setLoteActual] = useState(0);
  const [totalLotes, setTotalLotes] = useState(0);
  const [acumulado, setAcumulado] = useState<Acumulado>(ACUMULADO_VACIO);
  const [pausa, setPausa] = useState<{ lote: number; mensaje: string } | null>(null);
  const [transcurrido, setTranscurrido] = useState(0);
  const [confirmarDetener, setConfirmarDetener] = useState(false);
  const [deteniendo, setDeteniendo] = useState(false);
  const [comprobacion, setComprobacion] = useState<Final | null>(null);
  const [final, setFinal] = useState<Final | null>(null);

  const hojasRef = useRef<HojaLeida[]>([]);
  const lotesRef = useRef<FilaFactura[][]>([]);
  const acumRef = useRef<Acumulado>(ACUMULADO_VACIO);
  const detenerRef = useRef(false);
  const inicioRef = useRef(0);
  // Se crea al leer el primer archivo (solo en el navegador).
  const analizadorRef = useRef<Analizador | null>(null);

  const enviando = etapa === "enviando" || etapa === "pausado";
  const bloqueado = enviando || etapa === "leyendo";

  // Avisar antes de cerrar o recargar la pestaña a mitad de la carga.
  useEffect(() => {
    if (!enviando) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [enviando]);

  // Reloj del progreso.
  useEffect(() => {
    if (etapa !== "enviando") return;
    const t = window.setInterval(() => setTranscurrido(Date.now() - inicioRef.current), 1000);
    return () => window.clearInterval(t);
  }, [etapa]);

  // Si se sale de la pantalla por el menú, se deja de mandar lotes después del
  // actual y se cierra el worker del análisis.
  useEffect(() => {
    return () => {
      detenerRef.current = true;
      analizadorRef.current?.terminar();
    };
  }, []);

  // Derivados del análisis (costosos con ~47 000 facturas: solo cambian con la lectura).
  const derivados = useMemo(() => {
    if (!lectura) return null;
    const a = lectura.analisis;
    const existentes = codigosExistentes ? new Set(codigosExistentes) : null;
    const codigosArchivo = new Set(a.facturas.map((f) => codigoVendedor(f.vendedor)));
    const nuevos = existentes ? [...codigosArchivo].filter((c) => !existentes.has(c)).length : null;
    const grupos = agruparAvisos(a.avisos);
    const noSeImportan = grupos.filter((g) => !g.seImporta).reduce((n, g) => n + g.lista.length, 0);
    const calculadas = grupos
      .filter((g) => g.tipo === "usd_calculado" || g.tipo === "cs_calculado")
      .reduce((n, g) => n + g.lista.length, 0);
    const reconocidas = a.hojas.filter((h) => h.reconocida).length;
    const totalAnios = a.porAnio.reduce(
      (t, x) => ({
        facturas: t.facturas + x.facturas,
        anuladas: t.anuladas + x.anuladas,
        total_usd: t.total_usd + x.total_usd,
        total_cs: t.total_cs + x.total_cs,
      }),
      { facturas: 0, anuladas: 0, total_usd: 0, total_cs: 0 }
    );
    return { existentes, nuevos, grupos, noSeImportan, calculadas, reconocidas, totalAnios };
  }, [lectura, codigosExistentes]);

  function reiniciarEnvio() {
    acumRef.current = ACUMULADO_VACIO;
    setAcumulado(ACUMULADO_VACIO);
    setPausa(null);
    setFinal(null);
    setComprobacion(null);
    setLoteActual(0);
    setTotalLotes(0);
    setTranscurrido(0);
  }

  /**
   * Analiza las hojas leídas en un Web Worker (no congela la pantalla). Mismo
   * resultado que antes: analizar() + mapaOrigen(), ver ./lectura.ts. Si el
   * worker no está disponible, el analizador hace el cálculo aquí mismo.
   */
  async function analizarCon(tc: number, archivo: string) {
    const analizador = (analizadorRef.current ??= crearAnalizador());
    const { analisis, origen } = await analizador.analizar(hojasRef.current, tc, hoyManagua());
    setLectura({ archivo, analisis, origen });
    setTcUsado(tc);
    setTcTexto(String(tc));
    setEtapa("analizado");
  }

  async function leer(file: File | undefined) {
    if (!file || bloqueado) return;
    setErrorLectura(null);
    setErrorTc(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setErrorLectura("Elige un archivo .xlsx exportado de AG Negocio.");
      return;
    }
    reiniciarEnvio();
    setLectura(null);
    setMensajeOcupado(`Leyendo ${file.name}… puede tardar unos segundos.`);
    setEtapa("leyendo");
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const libro = await readXlsxFile(file);
      hojasRef.current = libro.map((h) => ({ nombre: h.sheet, filas: h.data as unknown as Celda[][] }));
      await analizarCon(TIPO_CAMBIO_POR_DEFECTO, file.name);
    } catch (e) {
      console.error("metas: lectura del Excel", e);
      hojasRef.current = [];
      setErrorLectura("No se pudo leer el archivo. Comprueba que sea un .xlsx exportado de AG Negocio.");
      setEtapa("inicio");
    }
  }

  async function recalcular() {
    if (!lectura) return;
    const tc = leerNumero(tcTexto);
    if (tc === null || tc <= 1 || tc > 1000) {
      setErrorTc("Escribe un tipo de cambio válido, por ejemplo 36.6243.");
      return;
    }
    setErrorTc(null);
    reiniciarEnvio();
    setMensajeOcupado("Recalculando con el nuevo tipo de cambio…");
    setEtapa("leyendo");
    try {
      await analizarCon(tc, lectura.archivo);
    } catch (e) {
      console.error("metas: recálculo del Excel", e);
      setErrorTc("No se pudo recalcular con ese tipo de cambio. Intenta de nuevo.");
      setEtapa("analizado");
    }
  }

  function acumular(r: { nuevas: number; actualizadas: number; vendedores_nuevos: number; errores: ErrorFila[]; fecha_min: string | null; fecha_max: string | null }, filas: number) {
    const a = acumRef.current;
    acumRef.current = {
      ...a,
      procesadas: a.procesadas + filas,
      nuevas: a.nuevas + (Number(r.nuevas) || 0),
      actualizadas: a.actualizadas + (Number(r.actualizadas) || 0),
      vendedoresNuevos: a.vendedoresNuevos + (Number(r.vendedores_nuevos) || 0),
      errores: r.errores.length ? [...a.errores, ...r.errores] : a.errores,
      fechaMin: menor(a.fechaMin, r.fecha_min),
      fechaMax: mayor(a.fechaMax, r.fecha_max),
    };
    setAcumulado(acumRef.current);
  }

  function terminar(m: Modo, detenido: boolean, lote: number, mensaje: string | null = null) {
    const resultado: Final = {
      modo: m,
      detenido,
      lote,
      totalLotes: lotesRef.current.length,
      mensaje,
      acumulado: acumRef.current,
      duracionMs: Date.now() - inicioRef.current,
    };
    setPausa(null);
    setDeteniendo(false);
    setConfirmarDetener(false);
    if (m === "comprobar") {
      setComprobacion(resultado);
      setEtapa("analizado");
      return;
    }
    setFinal(resultado);
    setEtapa("terminado");
    const a = resultado.acumulado;
    // Una sola revalidación por importación (no por lote), si algo se guardó.
    if (detenido) {
      show(`Importación detenida: ${entero(a.nuevas)} nuevas y ${entero(a.actualizadas)} actualizadas quedaron guardadas.`, "info");
    } else {
      show(`Importación terminada: ${entero(a.nuevas)} nuevas, ${entero(a.actualizadas)} actualizadas.`, "success");
    }
    if (a.importacionId) {
      void terminarImportacion()
        .catch((e) => console.error("metas: revalidar tras importar", e))
        .finally(() => router.refresh());
    }
  }

  async function correr(m: Modo, desde: number) {
    detenerRef.current = false;
    setPausa(null);
    setEtapa("enviando");
    const grupos = lotesRef.current;
    for (let i = desde; i < grupos.length; i++) {
      if (detenerRef.current) {
        terminar(m, true, i + 1);
        return;
      }
      setLoteActual(i);
      const fallo =
        m === "importar"
          ? `No se pudo guardar el lote ${i + 1}. Puedes reintentarlo sin riesgo de duplicar.`
          : `No se pudo comprobar el lote ${i + 1}. Puedes reintentarlo; la comprobación no guarda nada.`;
      let res: Awaited<ReturnType<typeof importarLote>>;
      try {
        res = await importarLote(m === "importar" ? acumRef.current.importacionId : null, lectura?.archivo ?? "", grupos[i], m === "importar");
      } catch (e) {
        // Red caída o tiempo de espera agotado.
        console.error("metas: lote", i + 1, e);
        setPausa({ lote: i, mensaje: fallo });
        setEtapa("pausado");
        return;
      }
      if (!res.ok || !res.data) {
        if (res.denegado) {
          terminar(m, true, i + 1, "Tu rol ya no permite importar facturas.");
          return;
        }
        // Reintentar no sirve: la importación de la base ya venció (o no es válida).
        if (res.message && /no existe o ya venció|no es válida/.test(res.message)) {
          terminar(
            m,
            true,
            i + 1,
            "La importación en curso venció. Las facturas ya enviadas quedan guardadas: vuelve a importar el archivo para completar la carga sin duplicar."
          );
          return;
        }
        setPausa({ lote: i, mensaje: res.message ? `${fallo} ${res.message}` : fallo });
        setEtapa("pausado");
        return;
      }
      if (m === "importar" && res.data.importacion_id) {
        acumRef.current = { ...acumRef.current, importacionId: res.data.importacion_id };
      }
      acumular(res.data, grupos[i].length);
      setTranscurrido(Date.now() - inicioRef.current);
    }
    terminar(m, false, grupos.length);
  }

  function empezar(m: Modo) {
    if (!lectura || lectura.analisis.facturas.length === 0) return;
    reiniciarEnvio();
    lotesRef.current = lotes(lectura.analisis.facturas, TAMANO_LOTE);
    setTotalLotes(lotesRef.current.length);
    setModo(m);
    inicioRef.current = Date.now();
    void correr(m, 0);
  }

  function pedirDetener() {
    detenerRef.current = true;
    setDeteniendo(true);
    setConfirmarDetener(false);
  }

  function detenerEnPausa() {
    if (!pausa) return;
    terminar(modo, true, pausa.lote + 1);
  }

  function nuevoArchivo() {
    reiniciarEnvio();
    setLectura(null);
    hojasRef.current = [];
    setEtapa("inicio");
  }

  const a = lectura?.analisis;
  const totalFacturas = a?.facturas.length ?? 0;
  const ubicar = (e: ErrorFila) => lectura?.origen.get(`${e.fila}|${e.numero.toUpperCase()}`) ?? "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Paso 1 */}
      <FormSection
        title="1. Archivo de AG Negocio"
        description="Elige el reporte de facturas de AG Negocio tal como sale, con todas sus hojas. Nexo reconoce las hojas de facturas e ignora el resto. Nada se guarda hasta que confirmes."
      >
        <label
          htmlFor={idArchivo}
          onDragOver={(e) => {
            e.preventDefault();
            if (!bloqueado) setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            void leer(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm text-neutral-600 transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${
            bloqueado
              ? "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60"
              : arrastrando
                ? "cursor-pointer border-blue-500 bg-blue-50"
                : "cursor-pointer border-neutral-300 hover:border-blue-400 hover:bg-blue-50/40"
          }`}
        >
          <span className="font-semibold text-blue-700">Elegir archivo .xlsx</span>
          <span className="text-xs text-neutral-500">o arrástralo aquí</span>
          <input
            id={idArchivo}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={bloqueado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void leer(f);
            }}
          />
        </label>
        <div aria-live="polite" className="text-sm">
          {etapa === "leyendo" ? (
            <p className="flex items-center gap-2 text-neutral-600">
              <Spinner className="size-3.5 text-blue-600" />
              {mensajeOcupado}
            </p>
          ) : lectura ? (
            <p className="min-w-0 break-all text-neutral-700">
              Archivo: <span className="font-medium text-neutral-900">{lectura.archivo}</span>
            </p>
          ) : null}
        </div>
        {errorLectura ? <Alert tone="error">{errorLectura}</Alert> : null}
      </FormSection>

      {/* Paso 2: todo lo de aquí se calcula en el navegador, sin red. */}
      {a && derivados ? (
        <FormSection
          title="2. Lo que se leyó"
          description="Esto sale solo del archivo; todavía no se consultó ni guardó nada en la base."
        >
          <div>
            <p className="text-sm text-neutral-700">
              {derivados.reconocidas} {derivados.reconocidas === 1 ? "hoja reconocida" : "hojas reconocidas"} y{" "}
              {a.hojas.length - derivados.reconocidas} {a.hojas.length - derivados.reconocidas === 1 ? "ignorada" : "ignoradas"}.
            </p>
            <ul className="mt-2 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {a.hojas.map((h, i) => (
                <li key={`${h.nombre}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="min-w-0 break-all font-medium text-neutral-900">{h.nombre}</span>
                  {h.reconocida ? (
                    <>
                      <StatusBadge label={`Facturas · ${entero(h.facturas)}`} tone="info" />
                      <span className="text-xs text-neutral-500">Encabezado en la fila {h.filaEncabezado}</span>
                    </>
                  ) : (
                    <>
                      <StatusBadge label="Ignorada" tone="neutral" />
                      <span className="text-xs text-neutral-500">{h.motivo}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {totalFacturas === 0 ? (
            <Alert tone="warning" title="No se encontró ninguna factura para importar">
              Comprueba que el archivo sea el reporte de facturas de venta de AG Negocio (con Fecha, N.º de factura,
              Vendedor y Total).
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Facturas a importar" value={entero(totalFacturas)} hint="Sin repetidas" />
                <MetricCard
                  label="Filas que no se importan"
                  value={entero(derivados.noSeImportan)}
                  tone={derivados.noSeImportan > 0 ? "warning" : "neutral"}
                  hint="Totales, vacías o repetidas"
                />
                <MetricCard
                  label="Vendedores nuevos"
                  value={derivados.nuevos === null ? "—" : entero(derivados.nuevos)}
                  hint={derivados.nuevos === null ? "No se pudo comparar con los registrados" : "Se crean al importar"}
                />
                <MetricCard
                  label="Rango de fechas"
                  value={a.fechaMin ? fechaCorta(a.fechaMin) : "—"}
                  hint={a.fechaMax ? `hasta ${fechaCorta(a.fechaMax)}` : undefined}
                />
              </div>

              <div className="rounded-lg border border-neutral-200 p-3">
                <Field
                  label="Tipo de cambio (C$ por US$)"
                  hint={`Solo se usa en las filas que traen un solo total (C$ o US$)${
                    derivados.calculadas > 0 ? `: afecta a ${entero(derivados.calculadas)} filas.` : "; este archivo no tiene ninguna."
                  }`}
                  error={errorTc}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-32">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={tcTexto}
                        onChange={(e) => setTcTexto(e.target.value)}
                        disabled={bloqueado}
                        className="tabular-nums"
                      />
                    </div>
                    <Button variant="secondary" onClick={recalcular} disabled={bloqueado || leerNumero(tcTexto) === tcUsado}>
                      Recalcular
                    </Button>
                    {a.tipoCambioDetectado !== null ? (
                      <span className="text-sm text-neutral-600">
                        Detectado en el archivo: <span className="font-medium tabular-nums">{a.tipoCambioDetectado}</span>
                      </span>
                    ) : null}
                  </div>
                </Field>
              </div>
            </>
          )}

          {derivados.grupos.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">Avisos</h3>
              {derivados.grupos.map((g) => (
                <details key={g.tipo} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <span
                      className={`mr-2 inline-block min-w-10 rounded px-1.5 text-center font-semibold tabular-nums ${
                        g.seImporta ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {entero(g.lista.length)}
                    </span>
                    {g.mensaje}
                  </summary>
                  <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-neutral-600">
                    {g.lista.slice(0, MAX_EJEMPLOS).map((av, i) => (
                      <li key={`${av.hoja}-${av.fila}-${i}`}>
                        Hoja {av.hoja} · fila {av.fila}
                        {av.numero ? <> · <span className="font-mono">{av.numero}</span></> : null}
                        {av.detalle ? ` (${av.detalle})` : null}
                      </li>
                    ))}
                    {g.lista.length > MAX_EJEMPLOS ? (
                      <li className="mt-1 text-neutral-500">
                        … y {entero(g.lista.length - MAX_EJEMPLOS)} más.
                      </li>
                    ) : null}
                  </ul>
                </details>
              ))}
            </div>
          ) : null}

          {totalFacturas > 0 ? (
            <>
              <p className="text-sm font-medium text-neutral-800">Compara estos totales con tu Excel antes de importar.</p>
              <DataTable
                caption="Facturas por año"
                density="compact"
                columns={COLUMNAS_ANIO}
                rows={
                  a.porAnio.length > 1
                    ? [...a.porAnio, { ...derivados.totalAnios, anio: 0, esTotal: true }]
                    : a.porAnio
                }
                rowKey={(x: FilaAnio) => (x.esTotal ? "total" : String(x.anio))}
              />
              <p className="text-xs text-neutral-500">Facturas y montos sin anuladas; las anuladas se importan pero no suman.</p>

              <DataTable
                caption="Facturas por vendedor"
                density="compact"
                maxHeight="24rem"
                columns={columnasVendedor(derivados.existentes)}
                rows={a.porVendedor}
                rowKey={(v) => v.vendedor}
              />

              {comprobacion ? <ResultadoComprobacion r={comprobacion} ubicar={ubicar} /> : null}

              {etapa !== "terminado" ? (
                <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
                  <p className="text-sm text-neutral-600">
                    Si una factura ya existe (mismo número) se actualiza; no se duplica. Las filas con error se informan y
                    las demás se guardan.
                  </p>
                  {/* La secundaria va primero y la primaria al final (regla del kit). */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => empezar("comprobar")} disabled={bloqueado}>
                      Comprobar contra la base (no guarda)
                    </Button>
                    <Button onClick={() => empezar("importar")} disabled={bloqueado}>
                      Importar {entero(totalFacturas)} facturas
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </FormSection>
      ) : null}

      {/* Paso 3: progreso */}
      {enviando ? (
        <FormSection
          title={modo === "importar" ? "3. Importando" : "Comprobando contra la base"}
          description={
            modo === "importar"
              ? "Se envían lotes de 1000 facturas, uno tras otro. No cierres esta pestaña hasta que termine."
              : "Se revisa cada lote en la base sin guardar nada."
          }
        >
          <div className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-label={modo === "importar" ? "Progreso de la importación" : "Progreso de la comprobación"}
              aria-valuemin={0}
              aria-valuemax={totalFacturas}
              aria-valuenow={acumulado.procesadas}
              aria-valuetext={`Lote ${loteActual + 1} de ${totalLotes} · ${entero(acumulado.procesadas)} de ${entero(totalFacturas)}`}
              className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
            >
              <div
                className="h-3 w-full origin-left rounded-full bg-blue-600 transition-transform duration-300 motion-reduce:transition-none"
                style={{ transform: `scaleX(${totalFacturas ? acumulado.procesadas / totalFacturas : 0})` }}
              />
            </div>
            {modo === "importar" ? (
              <Alert tone="warning">No salgas de esta página mientras se importa: se detendría después del lote en curso.</Alert>
            ) : null}
            <p className="flex flex-wrap justify-between gap-2 text-sm text-neutral-700">
              <span className="tabular-nums">
                Lote {Math.min(loteActual + 1, totalLotes)} de {totalLotes} · {entero(acumulado.procesadas)} de {entero(totalFacturas)}
              </span>
              <span className="tabular-nums text-neutral-500">Tiempo: {duracion(transcurrido)}</span>
            </p>
          </div>
          <dl aria-live="polite" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Contador etiqueta={modo === "importar" ? "Nuevas" : "Serían nuevas"} valor={acumulado.nuevas} />
            <Contador etiqueta={modo === "importar" ? "Actualizadas" : "Ya existen (se actualizan)"} valor={acumulado.actualizadas} />
            <Contador etiqueta="Con error" valor={acumulado.errores.length} alerta={acumulado.errores.length > 0} />
          </dl>

          {pausa ? (
            <Alert
              tone="error"
              action={
                <>
                  <Button variant="destructive-outline" size="sm" onClick={detenerEnPausa}>
                    Detener
                  </Button>
                  <Button size="sm" onClick={() => void correr(modo, pausa.lote)}>
                    Reintentar lote
                  </Button>
                </>
              }
            >
              {pausa.mensaje}
            </Alert>
          ) : deteniendo ? (
            <p role="status" className="flex items-center gap-2 text-sm text-neutral-600">
              <Spinner className="size-3.5" />
              Deteniendo después de este lote…
            </p>
          ) : (
            <div>
              <Button
                variant="destructive-outline"
                onClick={() => (modo === "importar" ? setConfirmarDetener(true) : pedirDetener())}
              >
                Detener después de este lote
              </Button>
            </div>
          )}
        </FormSection>
      ) : null}

      {/* Paso 4: resumen */}
      {final ? (
        <FormSection
          title={final.detenido ? `Importación detenida en el lote ${final.lote} de ${final.totalLotes}` : "Importación terminada"}
          description={
            final.detenido
              ? "Las facturas de los lotes ya enviados quedan guardadas. Puedes volver a subir el mismo archivo para completar la carga sin duplicar."
              : "Las facturas ya están en Nexo y cuentan en el avance de cada vendedor."
          }
        >
          {final.mensaje ? <Alert tone="error">{final.mensaje}</Alert> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Nuevas" value={entero(final.acumulado.nuevas)} tone="positive" />
            <MetricCard label="Actualizadas" value={entero(final.acumulado.actualizadas)} hint="Ya existían (mismo número)" />
            <MetricCard
              label="Con error"
              value={entero(final.acumulado.errores.length)}
              tone={final.acumulado.errores.length ? "negative" : "neutral"}
            />
            <MetricCard label="Vendedores nuevos" value={entero(final.acumulado.vendedoresNuevos)} />
            <MetricCard
              label="Rango"
              value={final.acumulado.fechaMin ? fechaCorta(final.acumulado.fechaMin) : "—"}
              hint={final.acumulado.fechaMax ? `hasta ${fechaCorta(final.acumulado.fechaMax)}` : undefined}
            />
            <MetricCard label="Duración" value={duracion(final.duracionMs)} />
          </div>
          {final.acumulado.errores.length > 0 ? (
            <TablaErrores errores={final.acumulado.errores} ubicar={ubicar} />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {puedeVincular && final.acumulado.vendedoresNuevos > 0 ? (
              <ButtonLink href="/configuracion/vendedores">Vincular vendedores nuevos</ButtonLink>
            ) : null}
            {puedeVerEquipo ? (
              <ButtonLink href="/dashboard?vista=equipo" variant="secondary">
                Ver avance del equipo
              </ButtonLink>
            ) : null}
            {final.detenido && lectura && lectura.analisis.facturas.length > 0 ? (
              <Button variant="secondary" onClick={() => empezar("importar")}>
                Volver a importar este archivo
              </Button>
            ) : null}
            <Button variant="link" onClick={nuevoArchivo}>
              Importar otro archivo
            </Button>
          </div>
        </FormSection>
      ) : null}

      <ConfirmDialog
        open={confirmarDetener}
        title="Detener la importación"
        description="Las facturas de los lotes ya enviados quedan guardadas. Puedes volver a subir el mismo archivo para completar la carga sin duplicar."
        confirmLabel="Detener después de este lote"
        cancelLabel="Seguir importando"
        destructive
        onConfirm={pedirDetener}
        onCancel={() => setConfirmarDetener(false)}
      />
    </div>
  );
}

function Contador({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{etiqueta}</dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${alerta ? "text-red-600" : "text-neutral-900"}`}>{entero(valor)}</dd>
    </div>
  );
}

function ResultadoComprobacion({ r, ubicar }: { r: Final; ubicar: (e: ErrorFila) => string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <p className="text-sm font-semibold text-neutral-900">
        {r.detenido ? `Comprobación detenida en el lote ${r.lote} de ${r.totalLotes}` : "Comprobación contra la base"} · no se
        guardó nada
      </p>
      {r.mensaje ? <Alert tone="error">{r.mensaje}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Serían nuevas" value={entero(r.acumulado.nuevas)} />
        <MetricCard label="Ya existen" value={entero(r.acumulado.actualizadas)} hint="Se actualizan, no se duplican" />
        <MetricCard label="Con error" value={entero(r.acumulado.errores.length)} tone={r.acumulado.errores.length ? "negative" : "positive"} />
      </div>
      {r.acumulado.errores.length > 0 ? <TablaErrores errores={r.acumulado.errores} ubicar={ubicar} /> : null}
    </div>
  );
}

function TablaErrores({ errores, ubicar }: { errores: ErrorFila[]; ubicar: (e: ErrorFila) => string }) {
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function descargar() {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const datos = [
        ["Hoja", "Fila", "N.º de factura", "Motivo"].map((v) => ({ value: v, fontWeight: "bold" as const })),
        ...errores.map((e) => [{ value: ubicar(e) }, { value: e.fila }, { value: e.numero }, { value: e.error }]),
      ];
      await writeXlsxFile(datos, { sheet: "Errores" }).toFile(`Errores_importacion_presupuesto_${hoyManagua()}.xlsx`);
    } catch (e) {
      console.error("metas: descarga de errores", e);
      setErrorDescarga("No se pudo generar el archivo de errores. Intenta de nuevo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-700">
          Este detalle no se guarda: <strong>descárgalo antes de salir</strong>.
        </p>
        <Button variant="secondary" onClick={descargar} loading={descargando}>
          {descargando ? "Preparando…" : "Descargar errores (.xlsx)"}
        </Button>
      </div>
      {errorDescarga ? <Alert tone="error">{errorDescarga}</Alert> : null}
      <DataTable
        caption="Filas con error"
        density="compact"
        maxHeight="20rem"
        columns={columnasErrores(ubicar)}
        rows={errores.slice(0, MAX_ERRORES_EN_PANTALLA).map((e, indice) => ({ ...e, indice }))}
        rowKey={(e) => String(e.indice)}
      />
      {errores.length > MAX_ERRORES_EN_PANTALLA ? (
        <p className="text-xs text-neutral-500">
          Se muestran {entero(MAX_ERRORES_EN_PANTALLA)} de {entero(errores.length)}. El archivo descargado los trae todos.
        </p>
      ) : null}
    </div>
  );
}
