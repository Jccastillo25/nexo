import { DataTable, FormSection } from "@nexo/ui";
import { fechaCorta, formatoDuracion, type Metricas, type MetricasAgente } from "@/lib/metricas";

export function TablaAgentes({ filas }: { filas: MetricasAgente[] }) {
  return (
    <FormSection title="Por agente" description="Tiempos solo de turnos atendidos; los que no se presentaron se cuentan aparte.">
      <DataTable
        rowKey={(f) => f.user_id}
        rows={filas}
        emptyLabel="Ningún agente atendió en el período."
        columns={[
          { key: "nombre", header: "Agente", render: (f) => <span className="font-medium text-neutral-900">{f.nombre}</span> },
          { key: "atendidos", header: "Atendidos", align: "right", render: (f) => <span className="tabular-nums">{f.atendidos}</span> },
          { key: "ausentes", header: "No se presentó", align: "right", render: (f) => <span className="tabular-nums">{f.no_se_presento}</span> },
          { key: "espera", header: "Espera prom.", align: "right", render: (f) => formatoDuracion(f.espera_prom) },
          { key: "atencion", header: "Atención prom.", align: "right", render: (f) => formatoDuracion(f.atencion_prom) },
          { key: "mediana", header: "Atención mediana", align: "right", render: (f) => formatoDuracion(f.atencion_mediana) },
          { key: "fuera", header: "Fuera de orden", align: "right", render: (f) => <span className="tabular-nums">{f.fuera_de_orden}</span> },
          { key: "sesion", header: "En puesto", align: "right", render: (f) => formatoDuracion(f.sesion_segundos) },
        ]}
      />
    </FormSection>
  );
}

export function TablaPuestos({ filas }: { filas: NonNullable<Metricas["por_puesto"]> }) {
  return (
    <FormSection title="Por puesto">
      <DataTable
        rowKey={(f) => f.puesto}
        rows={filas}
        emptyLabel="Ningún puesto atendió en el período."
        columns={[
          { key: "puesto", header: "Puesto", render: (f) => <span className="font-medium text-neutral-900">{f.puesto}</span> },
          { key: "atendidos", header: "Atendidos", align: "right", render: (f) => <span className="tabular-nums">{f.atendidos}</span> },
          { key: "atencion", header: "Atención prom.", align: "right", render: (f) => formatoDuracion(f.atencion_prom) },
        ]}
      />
    </FormSection>
  );
}

export function TablaDias({ filas }: { filas: Metricas["por_dia"] }) {
  const conDatos = filas.filter((d) => d.atendidos > 0 || d.no_se_presento > 0);
  return (
    <FormSection title="Por día">
      <DataTable
        rowKey={(f) => f.fecha}
        rows={[...conDatos].reverse()}
        emptyLabel="Sin turnos en el período."
        columns={[
          { key: "fecha", header: "Día", render: (f) => <span className="tabular-nums">{fechaCorta(f.fecha)}</span> },
          { key: "atendidos", header: "Atendidos", align: "right", render: (f) => <span className="tabular-nums">{f.atendidos}</span> },
          { key: "ausentes", header: "No se presentó", align: "right", render: (f) => <span className="tabular-nums">{f.no_se_presento}</span> },
          { key: "espera", header: "Espera prom.", align: "right", render: (f) => formatoDuracion(f.espera_prom) },
          { key: "atencion", header: "Atención prom.", align: "right", render: (f) => formatoDuracion(f.atencion_prom) },
        ]}
      />
    </FormSection>
  );
}
