import { NextRequest, NextResponse } from "next/server";
import { getSystemConfig } from "@/lib/services/sessions/sessionService";

/**
 * GET /api/v1/config/session
 * Obtiene la configuración de sesiones para inicializar timers en el cliente
 */
export async function GET(request: NextRequest) {
  try {
    const config = await getSystemConfig();

    return NextResponse.json(
      {
        inactivity_timeout_minutes: config.inactivityTimeoutMinutes,
        max_session_duration_minutes: config.maxSessionDurationMinutes,
        transfer_alert_timeout_seconds: config.transferAlertTimeoutSeconds,
        allow_multiple_sessions: config.allowMultipleSessions,
        require_2fa_new_device: config.require2faNewDevice,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching session config:", error);
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/config/session (solo para Owner)
 * Actualiza configuración global
 */
export async function PATCH(request: NextRequest) {
  try {
    // TODO: Verificar que el usuario es Owner
    // const { user, error } = await supabase.auth.getUser();
    // if (!isOwner(user.id)) return 403

    const body = await request.json();
    const {
      inactivity_timeout_minutes,
      max_session_duration_minutes,
      transfer_alert_timeout_seconds,
      allow_multiple_sessions,
    } = body;

    // TODO: Implementar actualización en base de datos
    // await supabase.from('system_config').update(...)

    return NextResponse.json(
      { message: "Configuración actualizada (no implementado aún)" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating session config:", error);
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}
