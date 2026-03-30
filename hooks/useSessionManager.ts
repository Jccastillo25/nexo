"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface SessionConfig {
  inactivity_timeout_minutes: number;
  max_session_duration_minutes: number;
  transfer_alert_timeout_seconds: number;
  allow_multiple_sessions: boolean;
  require_2fa_new_device: boolean;
}

export interface TransferAlertData {
  session_id: number;
  previous_device: {
    name: string;
    ip: string;
    last_login: string;
  };
  retry_after: number;
}

interface UseSessionManagerReturn {
  config: SessionConfig | null;
  isLoading: boolean;
  expiresAt: Date | null;
  secondsRemaining: number;
  showInactivityWarning: boolean;
  showTransferAlert: boolean;
  transferAlertData: TransferAlertData | null;
  handleExtendSession: () => void;
  handleTransferAccept: () => void;
  handleTransferReject: () => void;
}

/**
 * Hook para gestionar sesiones del usuario
 */
export function useSessionManager(): UseSessionManagerReturn {
  const router = useRouter();
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [showTransferAlert, setShowTransferAlert] = useState(false);
  const [transferAlertData, setTransferAlertData] =
    useState<TransferAlertData | null>(null);

  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const expiryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSessionRef = useRef<number | null>(null);

  // ========================================
  // 1. CARGAR CONFIGURACIÓN
  // ========================================
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/v1/config/session");
        if (!response.ok) throw new Error("Failed to load config");

        const data = await response.json();
        setConfig(data);

        // Calcular expiración basada en el tiempo máximo de sesión
        const expiryTime = new Date(
          Date.now() + data.max_session_duration_minutes * 60 * 1000
        );
        setExpiresAt(expiryTime);
      } catch (error) {
        console.error("Error loading session config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // ========================================
  // 2. RESETEAR TIMER DE INACTIVIDAD
  // ========================================
  const resetActivityTimer = useCallback(() => {
    if (!config) return;

    // Limpiar timers previos
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    setShowInactivityWarning(false);

    // Setear warning 5 minutos antes de expirar
    const warningTime =
      (config.inactivity_timeout_minutes - 5) * 60 * 1000;
    warningTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
    }, warningTime);

    // Setear logout automático al expirar
    const logoutTime = config.inactivity_timeout_minutes * 60 * 1000;
    activityTimerRef.current = setTimeout(() => {
      logout("inactivity");
    }, logoutTime);
  }, [config]);

  // ========================================
  // 3. MONITOREAR ACTIVIDAD DEL USUARIO
  // ========================================
  useEffect(() => {
    if (!config) return;

    const handlers = {
      click: () => resetActivityTimer(),
      scroll: () => resetActivityTimer(),
      keypress: () => resetActivityTimer(),
      touchstart: () => resetActivityTimer(),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      document.addEventListener(event, handler);
    });

    // Inicializar timer
    resetActivityTimer();

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        document.removeEventListener(event, handler);
      });

      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [config, resetActivityTimer]);

  // ========================================
  // 4. ACTUALIZAR CONTADOR DE TIEMPO RESTANTE
  // ========================================
  useEffect(() => {
    if (!expiresAt) return;

    expiryCheckIntervalRef.current = setInterval(() => {
      const now = new Date();
      const remaining = Math.max(0, expiresAt.getTime() - now.getTime());
      const seconds = Math.floor(remaining / 1000);

      setSecondsRemaining(seconds);

      // Auto-logout si pasó la hora
      if (seconds === 0) {
        logout("expired");
      }
    }, 1000);

    return () => {
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
      }
    };
  }, [expiresAt]);

  // ========================================
  // 5. EXTENDER SESIÓN
  // ========================================
  const handleExtendSession = useCallback(() => {
    if (!config) return;

    // Hacer API call dummy para resetear inactividad en servidor
    fetch("/api/v1/auth/extend", { method: "POST" }).catch(console.error);

    // Resetear timer en cliente
    resetActivityTimer();

    // Extender expiración
    const newExpiryTime = new Date(
      Date.now() + config.max_session_duration_minutes * 60 * 1000
    );
    setExpiresAt(newExpiryTime);
    setShowInactivityWarning(false);
  }, [config, resetActivityTimer]);

  // ========================================
  // 6. TRANSFERENCIA DE SESIÓN
  // ========================================
  const handleTransferAccept = useCallback(async () => {
    if (!pendingSessionRef.current) return;

    try {
      const response = await fetch("/api/v1/auth/confirm-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          session_id: pendingSessionRef.current,
          action: "accept",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("auth_token", data.token);
        setShowTransferAlert(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("Error accepting transfer:", error);
    }
  }, []);

  const handleTransferReject = useCallback(async () => {
    if (!pendingSessionRef.current) return;

    try {
      await fetch("/api/v1/auth/confirm-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          session_id: pendingSessionRef.current,
          action: "reject",
        }),
      });

      setShowTransferAlert(false);
      pendingSessionRef.current = null;
    } catch (error) {
      console.error("Error rejecting transfer:", error);
    }
  }, []);

  // ========================================
  // 7. LOGOUT
  // ========================================
  const logout = useCallback((reason: string = "manual") => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("device_id");
    // TODO: Enviar logout event al servidor
    router.push(`/login?reason=${reason}`);
  }, [router]);

  return {
    config,
    isLoading,
    expiresAt,
    secondsRemaining,
    showInactivityWarning,
    showTransferAlert,
    transferAlertData,
    handleExtendSession,
    handleTransferAccept,
    handleTransferReject,
  };
}
