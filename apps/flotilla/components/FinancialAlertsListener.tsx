"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];

type Toast = { id: string };

// Escucha en tiempo real (Supabase Realtime, migración 0019) los viajes de
// la empresa que quedan `completed` sin trip_value/invoice_number, para
// avisarle al admin sin que tenga que recargar /admin/fleet-trips.
export function FinancialAlertsListener({ companyId }: { companyId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`financial-alerts-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const trip = payload.new as TripRow;
          if (trip.status !== "completed") return;
          if (trip.trip_value !== null && trip.invoice_number !== null) return;

          const toastId = crypto.randomUUID();
          setToasts((prev) => [...prev, { id: toastId }]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 10000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-slate-900 px-4 py-3 shadow-lg"
        >
          <p className="text-sm text-slate-200">
            Un viaje finalizó sin datos de facturación completos.
          </p>
          <Link
            href="/admin/fleet-trips?financial=pending"
            className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900"
          >
            Ver
          </Link>
        </div>
      ))}
    </div>
  );
}
