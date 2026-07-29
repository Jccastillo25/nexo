"use client";

import { useRef, useState } from "react";

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

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    onCapture(file);
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
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800 px-4 py-6 text-base font-semibold text-slate-200 active:bg-slate-700"
      >
        {previewUrl ? "Volver a tomar foto" : "Tomar foto"}
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
