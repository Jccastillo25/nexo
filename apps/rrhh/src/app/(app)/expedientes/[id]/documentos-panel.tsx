"use client";

import { useRef, useState, useTransition } from "react";
import { useToast } from "@nexo/ui";
import { createClient } from "@/lib/supabase/client";
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
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fase 4 (2026-09-16, bloque pre-F1.5): pestaña "Documentos" del
 * expediente. Subida en dos pasos (URL firmada de subida directa) para no
 * repetir el bug P0 del 2026-09-14 (techo de 4.5MB de Vercel Functions) --
 * el archivo va del navegador directo a Storage, nunca por una Server
 * Action.
 */
export default function DocumentosPanel({
  empleadoId,
  documentos,
  canSubir,
  canDescargar,
  canEliminar,
}: DocumentosPanelProps) {
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("otro");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);

  function subir(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Elegí un archivo.");
      return;
    }
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

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("rrhh-documentos-privados")
          .uploadToSignedUrl(pedido.path, pedido.token, file);
        if (uploadError) {
          setError(`No se pudo subir el archivo: ${uploadError.message}`);
          show(`No se pudo subir el archivo: ${uploadError.message}`, "error");
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

  function eliminar(documentoId: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarDocumento(empleadoId, documentoId);
      if (!res.ok) {
        setError(res.message ?? "No se pudo eliminar el documento.");
        show(res.message ?? "No se pudo eliminar el documento.", "error");
      } else {
        show("Documento eliminado.", "success");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {canSubir && (
        <form onSubmit={subir} className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Tipo</span>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500"
            >
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">Archivo (PDF, JPG, PNG o Word, máx. 10 MB)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className="text-sm text-neutral-700"
            />
          </label>
          <button
            type="submit"
            disabled={isPending || subiendo}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {subiendo ? "Subiendo…" : "Subir"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {documentos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">Sin documentos cargados.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {TIPO_LABEL[d.tipoDocumento]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-900">{d.nombreOriginal}</td>
                  <td className="px-4 py-2.5 text-neutral-400">{formatBytes(d.tamanoBytes)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-3">
                      {canDescargar && (
                        <button
                          type="button"
                          onClick={() => descargar(d.id)}
                          className="text-neutral-500 hover:text-neutral-900"
                        >
                          Descargar
                        </button>
                      )}
                      {canEliminar && (
                        <button
                          type="button"
                          onClick={() => eliminar(d.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
