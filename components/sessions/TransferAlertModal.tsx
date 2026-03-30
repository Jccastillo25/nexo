"use client";

import React, { useEffect, useState } from "react";

interface Device {
  name: string;
  ip: string;
  last_login: string;
}

interface TransferAlertModalProps {
  isOpen: boolean;
  device: Device | null;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Modal bloqueante para alerta de transferencia de sesión
 */
export function TransferAlertModal({
  isOpen,
  device,
  onAccept,
  onReject,
}: TransferAlertModalProps) {
  const [countdown, setCountdown] = useState(60);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    if (!isOpen || hasResponded) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onAccept(); // Auto-aceptar al terminar countdown
          setHasResponded(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onAccept, hasResponded]);

  const handleAccept = () => {
    setHasResponded(true);
    onAccept();
  };

  const handleReject = () => {
    setHasResponded(true);
    onReject();
  };

  if (!isOpen || !device) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          padding: "24px",
          maxWidth: "400px",
          width: "90%",
        }}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
          🔐 Nuevo inicio de sesión detectado
        </h2>

        <div
          style={{
            backgroundColor: "#f3f4f6",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>Dispositivo:</strong> {device.name}
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>IP:</strong> {device.ip}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Hora:</strong>{" "}
            {new Date(device.last_login).toLocaleString()}
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#fef3c7",
            border: "1px solid #fbbf24",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "20px",
            fontSize: "14px",
            color: "#92400e",
          }}
        >
          ⏱️ Responde en: <strong>{countdown}s</strong>
          <div style={{ marginTop: "8px", fontSize: "12px" }}>
            Si no respondes, la transferencia se completará automáticamente.
          </div>
        </div>

        <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#666" }}>
          ¿Deseas transferir tu sesión a este dispositivo?
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={handleReject}
            disabled={hasResponded}
            style={{
              padding: "10px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              backgroundColor: "white",
              color: "#374151",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              opacity: hasResponded ? 0.6 : 1,
            }}
          >
            Rechazar
          </button>
          <button
            onClick={handleAccept}
            disabled={hasResponded}
            style={{
              padding: "10px 16px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "#10b981",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              opacity: hasResponded ? 0.6 : 1,
            }}
          >
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
}
