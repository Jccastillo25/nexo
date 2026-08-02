"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image-compression";

export function PhotoCaptureInput({
  label,
  required = false,
  onCapture,
}: {
  label: string;
  required?: boolean;
  onCapture: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = event.target.files?.[0] ?? null;
    if (!rawFile) {
      setPreviewUrl(null);
      onCapture(null);
      return;
    }

    setCompressing(true);
    const compressed = await compressImage(rawFile);
    setCompressing(false);

    setPreviewUrl(URL.createObjectURL(compressed));
    onCapture(compressed);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        required={required}
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        disabled={compressing}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800 px-4 py-6 text-base font-semibold text-slate-200 active:bg-slate-700 disabled:opacity-50"
      >
        {compressing ? "Optimizando foto..." : previewUrl ? "Volver a tomar foto" : "Tomar foto"}
      </button>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL), no un asset optimizable
        <img
          src={previewUrl}
          alt="Vista previa"
          className="h-40 w-full rounded-xl object-cover"
        />
      )}
    </div>
  );
}
