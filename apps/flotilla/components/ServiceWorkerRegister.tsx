"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Instalación PWA no crítica: la app sigue funcionando sin el SW.
      });
    }
  }, []);

  return null;
}
