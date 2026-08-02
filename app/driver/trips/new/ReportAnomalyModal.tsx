"use client";

import { useState } from "react";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
import { BigButton } from "@/components/BigButton";

type AnomalyCategory = { id: string; name: string; blocks_trip: boolean };

export function ReportAnomalyModal({
  categories,
  onClose,
  onSubmit,
}: {
  categories: AnomalyCategory[];
  onClose: () => void;
  onSubmit: (params: {
    categoryId: string;
    blocksTrip: boolean;
    description: string;
    photo: File;
  }) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AnomalyCategory | null>(null);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selected) {
      setError("Selecciona la categoría afectada.");
      return;
    }
    if (!photo) {
      setError("Toma una foto de la novedad.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        categoryId: selected.id,
        blocksTrip: selected.blocks_trip,
        description,
        photo,
      });
    } catch {
      setError("No se pudo enviar el reporte. Verifica tu conexión e inténtalo de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-slate-900 p-6 sm:rounded-2xl">
        <h2 className="mb-4 text-xl font-bold text-white">Reportar novedad</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-300">Categoría afectada</span>
            <div className="grid grid-cols-1 gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`rounded-xl px-4 py-3 text-left font-semibold ${
                    selected?.id === c.id ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-slate-500">
                  Tu empresa todavía no tiene categorías de novedad configuradas.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            />
          </div>

          <PhotoCaptureInput label="Foto de la novedad" required onCapture={setPhoto} />

          {error && <p className="text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl bg-slate-800 px-4 py-4 font-bold text-slate-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <BigButton type="submit" variant="danger" loading={submitting} className="flex-1">
              Enviar reporte
            </BigButton>
          </div>
        </form>
      </div>
    </div>
  );
}
