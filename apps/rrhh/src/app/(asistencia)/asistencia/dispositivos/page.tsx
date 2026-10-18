import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { permisosAsistenciaDe } from "@/lib/permisos-asistencia";
import DispositivosPanel, { type DispositivoFila, type EstadoEquipo } from "./dispositivos-panel";

export const metadata: Metadata = {
  title: "Dispositivos · Asistencia",
};

const TITULO = "Dispositivos de marcación";
const DESCRIPCION = "Terminales autorizadas para registrar entradas y salidas.";

/**
 * Configuración → Dispositivos (2026-10-17). Lista rrhh.kiosko_dispositivos
 * (RLS por permiso) y permite registrar, editar, desactivar y reactivar.
 *
 * Lo que llega al navegador se arma aquí:
 * - el `id` solo viaja con `kioskos.editar`, `kioskos.asignar` o
 *   `kioskos.revocar` (lo necesitan las acciones y "Copiar identificador");
 *   sin esos permisos cada fila lleva una clave posicional;
 * - `NEXO_KIOSKO_ID` (la terminal de este despliegue) se compara en el
 *   servidor y solo baja un booleano `enUso` por fila, nunca el valor;
 * - el estado del equipo (asistencia_estado_terminales, enrolamiento
 *   2026-10-17) baja como estado + fechas ya formateadas, nunca hashes.
 */
export default async function DispositivosPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const permisos = await permisosAsistenciaDe(companyId);

  if (!permisos.kioskosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={TITULO} description={DESCRIPCION} />
        <EmptyState
          title="No tienes acceso a los dispositivos"
          description="Tu rol no permite ver las terminales de marcación. Pide acceso a tu administrador."
        />
      </div>
    );
  }

  const [lista, terminales] = await Promise.all([
    supabase
      .schema("rrhh")
      .from("kiosko_dispositivos")
      .select("id, nombre, ubicacion, activo, created_at")
      .eq("company_id", companyId)
      .order("nombre"),
    supabase.rpc("asistencia_estado_terminales", { p_company_id: companyId }),
  ]);
  const { data, error } = lista;

  if (error) {
    console.error("Dispositivos de Asistencia: no se pudo cargar la lista", error);
  }
  if (terminales.error) {
    console.error("Dispositivos de Asistencia: no se pudo consultar el estado de los equipos", terminales.error);
  }

  const kioskoDeEsteDespliegue = process.env.NEXO_KIOSKO_ID;
  const zona = "America/Managua";
  const formatoFecha = new Intl.DateTimeFormat("es-NI", { timeZone: zona, dateStyle: "medium" });
  const formatoFechaHora = new Intl.DateTimeFormat("es-NI", { timeZone: zona, dateStyle: "medium", timeStyle: "short" });
  const formatoHora = new Intl.DateTimeFormat("es-NI", { timeZone: zona, hour: "2-digit", minute: "2-digit" });
  const fecha = (valor: string | null, formato: Intl.DateTimeFormat) => (valor ? formato.format(new Date(valor)) : null);

  const estadoPorKiosko = new Map((terminales.error ? [] : (terminales.data ?? [])).map((t) => [t.kiosko_id, t]));
  // El id viaja al navegador solo si alguna acción de fila lo necesita.
  const conId = permisos.kioskosEditar || permisos.kioskosAsignar || permisos.kioskosRevocar;

  const filas: DispositivoFila[] = (data ?? []).map((d, i) => {
    const t = estadoPorKiosko.get(d.id);
    const equipo: EstadoEquipo | null = terminales.error
      ? null
      : t?.estado === "asignada" || t?.estado === "codigo_pendiente"
        ? t.estado
        : "sin_asignar";
    return {
      clave: conId ? d.id : `fila-${i}`,
      id: conId ? d.id : null,
      nombre: d.nombre,
      ubicacion: d.ubicacion,
      activo: d.activo,
      registrado: formatoFecha.format(new Date(d.created_at)),
      enUso: Boolean(kioskoDeEsteDespliegue) && d.id === kioskoDeEsteDespliegue,
      equipo,
      codigoVenceHora: fecha(t?.codigo_vence_en ?? null, formatoHora),
      ultimoUso: fecha(t?.ultimo_uso_en ?? null, formatoFechaHora),
      revocadoEl: fecha(t?.revocado_en ?? null, formatoFechaHora),
    };
  });

  return (
    <DispositivosPanel
      titulo={TITULO}
      descripcion={DESCRIPCION}
      filas={filas}
      errorDeCarga={Boolean(error)}
      errorEquipos={Boolean(terminales.error)}
      canCrear={permisos.kioskosCrear}
      canEditar={permisos.kioskosEditar}
      canAsignar={permisos.kioskosAsignar}
      canRevocar={permisos.kioskosRevocar}
    />
  );
}
