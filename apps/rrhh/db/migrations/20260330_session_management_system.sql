-- ============================================================================
-- MÓDULO DE GESTIÓN DE SESIONES Y DISPOSITIVOS - Gestor360
-- Migration: 20260330_session_management_system.sql
-- ============================================================================

-- 1. TABLA: sessions
-- Almacena todas las sesiones (activas e históricas)
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  device_name VARCHAR(255),
  ip_address INET,
  user_agent VARCHAR(500),
  fingerprint VARCHAR(500),
  token VARCHAR(500) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE: sesión vigente
    -- PENDING_TRANSFER: esperando confirmación de transferencia
    -- TRANSFERRED: trasladada a otro dispositivo
    -- REVOKED: rechazada o cancelada
    -- EXPIRED: expirada por timeout
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Índices para búsqueda rápida
  CONSTRAINT sessions_user_status_idx UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status) WHERE status != 'EXPIRED';
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);

-- ============================================================================
-- 2. TABLA: devices
-- Almacena dispositivos únicos con fingerprint persistente
CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(255) PRIMARY KEY,  -- UUID del dispositivo
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint VARCHAR(500) NOT NULL,  -- SHA256(user-agent+IP+...)
  device_name VARCHAR(255),           -- "Chrome en Windows 10"
  is_trusted BOOLEAN DEFAULT FALSE,   -- Dispositivo verificado/confiable
  user_agent VARCHAR(500),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen DESC);

-- ============================================================================
-- 3. TABLA: system_config
-- Configuración global de sesiones y timeouts
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value VARCHAR(500),
  type VARCHAR(50),  -- 'int', 'bool', 'string'
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insertar valores por defecto
INSERT INTO system_config (key, value, type, description)
VALUES
  ('inactivity_timeout_minutes', '30', 'int', 'Timeout de inactividad en minutos'),
  ('max_session_duration_minutes', '480', 'int', 'Duración máxima de sesión (8 horas)'),
  ('transfer_alert_timeout_seconds', '60', 'int', 'Tiempo para responder alerta de transferencia'),
  ('allow_multiple_sessions', 'false', 'bool', 'Permitir múltiples sesiones por usuario'),
  ('require_2fa_new_device', 'false', 'bool', 'Requerir 2FA para nuevos dispositivos')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. Extender tabla audit_logs para sesiones
-- Si no existe, se asume que ya existe de migraciones anteriores
-- ============================================================================

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Trigger: Actualizar timestamp en sessions
CREATE OR REPLACE FUNCTION update_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_update_timestamp ON sessions;
CREATE TRIGGER sessions_update_timestamp
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_sessions_timestamp();

-- Trigger: Actualizar last_seen en devices
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE devices
  SET last_seen = NOW(), updated_at = NOW()
  WHERE id = NEW.device_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_update_device_last_seen ON sessions;
CREATE TRIGGER sessions_update_device_last_seen
AFTER INSERT OR UPDATE ON sessions
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE FUNCTION update_device_last_seen();

-- ============================================================================
-- 6. FUNCIONES HELPER
-- ============================================================================

-- Función: Obtener sesiones activas de un usuario
CREATE OR REPLACE FUNCTION get_active_sessions(p_user_id UUID)
RETURNS TABLE(
  session_id BIGINT,
  device_id VARCHAR,
  device_name VARCHAR,
  ip_address INET,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.device_id,
    s.device_name,
    s.ip_address,
    s.expires_at,
    s.last_activity
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.status = 'ACTIVE'
    AND s.expires_at > NOW()
  ORDER BY s.last_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- Función: Limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(cleaned_count INT) AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE sessions
  SET status = 'EXPIRED', updated_at = NOW()
  WHERE status IN ('ACTIVE', 'PENDING_TRANSFER')
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Función: Registrar evento de sesión en auditoría
CREATE OR REPLACE FUNCTION audit_session_event(
  p_user_id UUID,
  p_action VARCHAR,
  p_session_id BIGINT,
  p_device_id VARCHAR,
  p_ip_address INET,
  p_user_agent VARCHAR,
  p_details JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id, ip_address,
    user_agent, details, created_at
  ) VALUES (
    p_user_id, p_action, 'SESSION', p_device_id, p_ip_address,
    p_user_agent, COALESCE(p_details, jsonb_build_object('session_id', p_session_id)), NOW()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VISTAS ÚTILES
-- ============================================================================

-- Vista: Sesiones activas por usuario
DROP VIEW IF EXISTS v_active_sessions CASCADE;
CREATE VIEW v_active_sessions AS
SELECT
  u.id as user_id,
  u.email,
  s.id as session_id,
  s.device_name,
  s.ip_address,
  s.last_activity,
  s.expires_at,
  EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 60 as minutes_until_expiry,
  s.created_at
FROM auth.users u
LEFT JOIN sessions s ON u.id = s.user_id
WHERE s.status = 'ACTIVE' AND s.expires_at > NOW()
ORDER BY u.email, s.last_activity DESC;

-- Vista: Dispositivos confiables
DROP VIEW IF EXISTS v_trusted_devices CASCADE;
CREATE VIEW v_trusted_devices AS
SELECT
  u.id as user_id,
  u.email,
  d.id as device_id,
  d.device_name,
  d.is_trusted,
  d.last_seen,
  d.created_at
FROM auth.users u
LEFT JOIN devices d ON u.id = d.user_id
WHERE d.is_trusted = TRUE
ORDER BY u.email, d.last_seen DESC;

-- ============================================================================
-- 8. POLÍTICAS DE SEGURIDAD (RLS - Row Level Security)
-- ============================================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS: Usuarios solo ven sus propias sesiones
DROP POLICY IF EXISTS sessions_own_records ON sessions;
CREATE POLICY sessions_own_records ON sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS: Usuarios pueden crear sus propias sesiones
DROP POLICY IF EXISTS sessions_create_own ON sessions;
CREATE POLICY sessions_create_own ON sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS: Usuarios pueden actualizar sus propias sesiones
DROP POLICY IF EXISTS sessions_update_own ON sessions;
CREATE POLICY sessions_update_own ON sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS: Usuarios solo ven sus propios dispositivos
DROP POLICY IF EXISTS devices_own_records ON devices;
CREATE POLICY devices_own_records ON devices
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS: Usuarios pueden crear sus propios dispositivos
DROP POLICY IF EXISTS devices_create_own ON devices;
CREATE POLICY devices_create_own ON devices
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS: system_config es de solo lectura para todos
DROP POLICY IF EXISTS system_config_read_all ON system_config;
CREATE POLICY system_config_read_all ON system_config
  FOR SELECT
  USING (true);

-- ============================================================================
-- 9. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================================================

-- Para limpieza automática de sesiones expiradas
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup ON sessions(status, expires_at)
WHERE status IN ('ACTIVE', 'PENDING_TRANSFER');

-- Para búsqueda rápida de sesiones por usuario sin filtro de estado
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(user_id, created_at DESC);

-- Para búsqueda de dispositivos activos
CREATE INDEX IF NOT EXISTS idx_devices_trusted ON devices(user_id, is_trusted, last_seen DESC);

-- ============================================================================
-- FIN DE MIGRATION
-- ============================================================================
