"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger" | "neutral" | "success";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-amber-400 text-slate-900 active:bg-amber-300",
  danger: "bg-red-600 text-white active:bg-red-500",
  neutral: "bg-slate-700 text-white active:bg-slate-600",
  success: "bg-emerald-500 text-slate-950 active:bg-emerald-400",
};

export function BigButton({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`w-full rounded-2xl px-6 py-5 text-xl font-bold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {loading ? "Procesando..." : children}
    </button>
  );
}
