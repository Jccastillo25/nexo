"use client";

import { useCallback, useEffect, useState } from "react";
import { countPendingEvents } from "./db";
import { flushPendingEvents } from "./sync";

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const refreshCount = useCallback(async () => {
    setPendingCount(await countPendingEvents());
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushPendingEvents();
    await refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Reintento en primer plano: cubre Safari iOS, que no soporta
    // la Background Sync API para reintentar en segundo plano.
    const interval = setInterval(sync, 20000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshCount, sync]);

  return { pendingCount, isOnline, syncNow: sync };
}
