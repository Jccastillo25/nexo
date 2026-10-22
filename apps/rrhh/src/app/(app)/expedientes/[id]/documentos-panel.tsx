"use client";

import { useId, useRef, useState, useTransition } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  NexoIcon,
  RowActionIcons,
  Select,
  StatusBadge,
  fechaCorta,
  useToast,
} from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import {
  pedirUrlSubidaDocumento,
  confirmarDocumentoSubido,
  pedirUrlDescargaDocumento,
  eliminarDocumento,
  type TipoDocumento,
} from "./documentos-actions";

export interface DocumentoRow {
  id: string;
  tipoDocumento: TipoDocumento;
  nombreOriginal: string;
  tamanoBytes: number;
  subidoAt: string;
}

export interface DocumentosPanelProps {
  empleadoId: string;
  documentos: DocumentoRow[];
  canSubir: boolean;
  canDescargar: boolean;
  canEliminar: boolean;
}

const TIPO_LABEL: Record<TipoDocumento, string> = {
  cedula: "Cédula",
  curriculum: "Currículum",
  titulo: "Título",
  contrato_firmado: "Contrato firmado",
  otro: "Otro",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fase 4 (2026-09-16, bloque pre-F1.5): pestaña "Documentos" del
 * expediente. Subida en dos pasos (URL firmada de subida directa) para no
 * repetir el bug P0 del 2026-09-14 (techo de 4.5MB de Vercel Functions) --
 * el archivo va del navegador directo a Storage, nunca por una Server
 * Action.
 *
 * Rendimiento (2026-10-20): el cliente de Supabase del navegador (~268 KB)
 * solo se usa para subir, así que se carga con import() dinámico dentro del
 * manejador de subida, no con la pantalla.
 */
export default function DocumentosPanel({
  empleadoId,
  documentos,
  canSubir,
  canDescargar,
  canEliminar,
}: DocumentosPanelProps) {
  const { show } = useToast();
  const archivoId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("otro");
  const [error, setError] = useState<string | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<DocumentoRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);

  function subir(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorArchivo("Elige un archivo para subir.");
      return;
    }
    setErrorArchivo(null);
    setError(null);
    setSubiendo(true);
    startTransition(async () => {
      try {
        const pedido = await pedirUrlSubidaDocumento(empleadoId, {
          nombreOriginal: file.name,
          mimeType: file.type,
          tamanoBytes: file.size,
          tipoDocumento,
        });
        if (!pedido.ok || !pedido.signedUrl || !pedido.token || !pedido.path) {
          setError(pedido.message ?? "No se pudo iniciar la subida.");
          show(pedido.message ?? "No se pudo iniciar la subida.", "error");
          return;
        }

        const { createBrowserClient } = await import("@nexo/supabase/client");
        const supabase = createBrowserClient<Database>();
        const { error: uploadError } = await supabase.storage
          .from("rrhh-documentos-privados")
          .uploadToSignedUrl(pedido.path, pedido.token, file);
        if (uploadError) {
          // El detalle de Storage queda en la consola; la UI muestra un
          // mensaje propio (revisión de seguridad 2026-10-17, H2).
          console.error("subirDocumento: uploadToSignedUrl", uploadError);
          const mensaje = "No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.";
          setError(mensaje);
          show(mensaje, "error");
          return;
        }

        const confirmado = await confirmarDocumentoSubido(empleadoId, {
          path: pedido.path,
          nombreOriginal: file.name,
          mimeType: file.type,
          tamanoBytes: file.size,
          tipoDocumento,
        });
        if (!confirmado.ok) {
          setError(confirmado.message ?? "El archivo se subió pero no se pudo registrar.");
          show(confirmado.message ?? "El archivo se subió pero no se pudo registrar.", "error");
          return;
        }

        show("Documento subido.", "success");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        // Falla de red al cargar el cliente de Supabase (import dinámico) o
        // al llamar una Server Action: se avisa en el panel sin tumbar la
        // ficha. El detalle técnico queda solo en la consola.
        console.error("subirDocumento", err);
        const mensaje = "No se pudo subir el documento. Intenta de nuevo.";
        setError(mensaje);
        show(mensaje, "error");
      } finally {
        setSubiendo(false);
      }
    });
  }

  function descargar(documentoId: string) {
    setError(null);
    startTransition(async () => {
      const res = await pedirUrlDescargaDocumento(documentoId);
      if (!res.ok || !res.signedUrl) {
        setError(res.message ?? "No se pudo generar la descarga.");
        show(res.message ?? "No se pudo generar la descarga.", "error");
        return;
      }
      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  function confirmarEliminar() {
    if (!porEliminar) return;
    const documentoId = porEliminar.id;
    setError(null);
    startTransition(async () => {
      const res = await eliminarDocumento(empleadoId, documentoId);
      setPorEliminar(null);
      if (!res.ok) {
        setError(res.message ?? "No se pudo eliminar el documento.");
        show(res.message ?? "No se pudo eliminar el documento.", "error");
      } else {
        show("Documento eliminado.", "success");
      }
    });
  }

  const ocupado = isPending || subiendo;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canSubir ? (
        <form
          onSubmit={subir}
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:flex-row sm:flex-wrap sm:items-start"
        >
          <Field label="Tipo" className="sm:w-48">
            <Select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}>
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Archivo"
            id={archivoId}
            hint="PDF, JPG, PNG o Word (.docx), de hasta 10 MB."
            error={errorArchivo}
            className="sm:flex-1"
          >
            <input
              id={archivoId}
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              aria-describedby={`${archivoId}-ayuda${errorArchivo ? ` ${archivoId}-error` : ""}`}
              aria-invalid={errorArchivo ? true : undefined}
              onChange={() => setErrorArchivo(null)}
              className="block w-full min-w-0 text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
          </Field>
          <div className="sm:pt-6">
            {/* Mientras sube, `loading` ya bloquea el reenvío sin quitar el foco;
                `disabled` solo cuando hay otra acción en curso. */}
            <Button type="submit" loading={subiendo} disabled={ocupado && !subiendo} icon={<NexoIcon name="upload" />}>
              {subiendo ? "Subiendo…" : "Subir documento"}
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        rows={documentos}
        rowKey={(d) => d.id}
        density="compact"
        caption="Documentos del empleado"
        empty={<EmptyState bare title="Sin documentos cargados" />}
        columns={[
          {
            key: "nombre",
            header: "Documento",
            render: (d) => <span className="break-all text-neutral-900">{d.nombreOriginal}</span>,
          },
          {
            key: "tipo",
            header: "Tipo",
            render: (d) => <StatusBadge label={TIPO_LABEL[d.tipoDocumento]} tone="neutral" dot={false} />,
          },
          { key: "subido", header: "Subido", render: (d) => fechaCorta(d.subidoAt) },
          { key: "tamano", header: "Tamaño", numeric: true, render: (d) => formatBytes(d.tamanoBytes) },
          ...(canDescargar || canEliminar
            ? [
                {
                  key: "acciones",
                  header: "Acciones",
                  align: "right" as const,
                  render: (d: DocumentoRow) => (
                    <div className="flex items-center justify-end gap-1">
                      {canDescargar ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ocupado}
                          onClick={() => descargar(d.id)}
                          aria-label={`Descargar ${d.nombreOriginal}`}
                        >
                          Descargar
                        </Button>
                      ) : null}
                      {canEliminar ? (
                        <RowActionIcons
                          actions={[
                            {
                              key: "eliminar",
                              icon: "trash",
                              label: `Eliminar ${d.nombreOriginal}`,
                              destructive: true,
                              disabled: ocupado,
                              onClick: () => setPorEliminar(d),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />

      <ConfirmDialog
        open={porEliminar !== null}
        title="Eliminar documento"
        description={
          porEliminar
            ? `¿Eliminar «${porEliminar.nombreOriginal}» del expediente? Dejará de aparecer en la lista y no se podrá descargar.`
            : undefined
        }
        confirmLabel="Eliminar documento"
        destructive
        pending={isPending}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
