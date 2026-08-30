"use client";

import React, { useEffect, useState } from "react";

interface InactivityWarningProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
}

/**
 * Notificación visual de expiración próxima
 */
export function InactivityWarning({
  isOpen,
  secondsRemaining,
  onExtend,
}: InactivityWarningProps) {
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setMinutes(Math.floor(secondsRemaining / 60));
    setSeconds(secondsRemaining % 60);
  }, [secondsRemaining]);

  if (!isOpen) return null;

  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        backgroundColor: "#fff7ed",
        border: "1px solid #fed7aa",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
        padding: "16px",
        maxWidth: "400px",
        zIndex: 1000,
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <div style={{ fontSize: "20px" }}>⏱️</div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "14px",
              fontWeight: 600,
              color: "#92400e",
            }}
          >
            Tu sesión está por expirar
          </h3>
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "13px",
              color: "#b45309",
            }}
          >
            Tiempo restante: <strong>{formattedTime}</strong>
          </p>
          <button
            onClick={onExtend}
            style={{
              padding: "8px 12px",
              backgroundColor: "#f97316",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Extender sesión
          </button>
        </div>
      </div>
    </div>
  );
}
