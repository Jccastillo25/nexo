"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function SearchBox({
  initialValue,
}: {
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, N° o RUC…"
        aria-label="Buscar clientes"
        className="w-full rounded-sm border border-acero-medio/40 bg-white px-3 py-2 font-mono text-sm text-acero outline-none focus:border-naranja focus:ring-1 focus:ring-naranja"
      />
    </div>
  );
}
