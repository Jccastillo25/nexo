-- =============================================================================
-- Migration: user_permissions table
-- Gestor360 — Norma de Permisos v2.0.0
-- Cada permiso está vinculado a un recurso, acción o elemento UI del sistema.
-- La tabla sigue el patrón DENY BY DEFAULT: todas las columnas arrancan en FALSE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
  profile_id   UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ─── Centro de Control ────────────────────────────────────────────────────
  can_view_kpis_talent      BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_kpis_attendance  BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_kpis_financial   BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_kpis_hardware    BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_kiosks         BOOLEAN NOT NULL DEFAULT FALSE,

  -- ─── Talento ──────────────────────────────────────────────────────────────
  can_view_employees        BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_employees      BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_contracts        BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_contracts      BOOLEAN NOT NULL DEFAULT FALSE,

  -- ─── Turnos ───────────────────────────────────────────────────────────────
  can_view_shift_templates  BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_shift_templates BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_schedules      BOOLEAN NOT NULL DEFAULT FALSE,

  -- ─── Asistencia ───────────────────────────────────────────────────────────
  can_view_attendance       BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_attendance     BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve_corrections   BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_leaves         BOOLEAN NOT NULL DEFAULT FALSE,

  -- ─── Nómina ───────────────────────────────────────────────────────────────
  can_view_reports          BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_payroll          BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_payroll        BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_salary           BOOLEAN NOT NULL DEFAULT FALSE,

  -- ─── Sistema ──────────────────────────────────────────────────────────────
  can_manage_company        BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_settings       BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_users          BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_roles          BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_audit_logs       BOOLEAN NOT NULL DEFAULT FALSE,
  can_impersonate           BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (profile_id, company_id)
);

-- Índice para búsquedas por empresa (usado en middleware y guards de UI)
CREATE INDEX IF NOT EXISTS idx_user_permissions_company
  ON public.user_permissions (company_id);

-- Índice para búsquedas por usuario (usado en GlobalContext)
CREATE INDEX IF NOT EXISTS idx_user_permissions_profile
  ON public.user_permissions (profile_id);

-- Trigger: auto-actualizar updated_at en cada modificación
CREATE OR REPLACE FUNCTION update_user_permissions_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_user_permissions_timestamp();

-- =============================================================================
-- Row Level Security
-- Política: los usuarios solo pueden ver/editar sus propios permisos.
-- Los owners y admins de la empresa pueden ver/editar los de otros miembros.
-- =============================================================================

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Política SELECT: el propio usuario o admin/owner de la empresa
CREATE POLICY "user_permissions_select"
  ON public.user_permissions
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = user_permissions.company_id
        AND cm.role IN ('owner', 'admin')
        AND cm.is_active = TRUE
    )
  );

-- Política INSERT: solo owner/admin de la empresa puede crear
CREATE POLICY "user_permissions_insert"
  ON public.user_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = user_permissions.company_id
        AND cm.role IN ('owner', 'admin')
        AND cm.is_active = TRUE
    )
  );

-- Política UPDATE: solo owner/admin de la empresa puede modificar
CREATE POLICY "user_permissions_update"
  ON public.user_permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = user_permissions.company_id
        AND cm.role IN ('owner', 'admin')
        AND cm.is_active = TRUE
    )
  );

-- Política DELETE: solo owner puede eliminar
CREATE POLICY "user_permissions_delete"
  ON public.user_permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = user_permissions.company_id
        AND cm.role = 'owner'
        AND cm.is_active = TRUE
    )
  );

-- =============================================================================
-- Función auxiliar: get_user_permissions(uid, company_id)
-- Retorna los permisos de un usuario para una empresa.
-- Devuelve FALSE en todas las columnas si no existe registro (DENY BY DEFAULT).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_permissions(
  p_user_id   UUID,
  p_company_id UUID
)
RETURNS TABLE (
  can_view_kpis_talent      BOOLEAN,
  can_view_kpis_attendance  BOOLEAN,
  can_view_kpis_financial   BOOLEAN,
  can_view_kpis_hardware    BOOLEAN,
  can_manage_kiosks         BOOLEAN,
  can_view_employees        BOOLEAN,
  can_manage_employees      BOOLEAN,
  can_view_contracts        BOOLEAN,
  can_manage_contracts      BOOLEAN,
  can_view_shift_templates  BOOLEAN,
  can_manage_shift_templates BOOLEAN,
  can_manage_schedules      BOOLEAN,
  can_view_attendance       BOOLEAN,
  can_manage_attendance     BOOLEAN,
  can_approve_corrections   BOOLEAN,
  can_manage_leaves         BOOLEAN,
  can_view_reports          BOOLEAN,
  can_view_payroll          BOOLEAN,
  can_manage_payroll        BOOLEAN,
  can_view_salary           BOOLEAN,
  can_manage_company        BOOLEAN,
  can_manage_settings       BOOLEAN,
  can_manage_users          BOOLEAN,
  can_manage_roles          BOOLEAN,
  can_view_audit_logs       BOOLEAN,
  can_impersonate           BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(up.can_view_kpis_talent,      FALSE),
    COALESCE(up.can_view_kpis_attendance,  FALSE),
    COALESCE(up.can_view_kpis_financial,   FALSE),
    COALESCE(up.can_view_kpis_hardware,    FALSE),
    COALESCE(up.can_manage_kiosks,         FALSE),
    COALESCE(up.can_view_employees,        FALSE),
    COALESCE(up.can_manage_employees,      FALSE),
    COALESCE(up.can_view_contracts,        FALSE),
    COALESCE(up.can_manage_contracts,      FALSE),
    COALESCE(up.can_view_shift_templates,  FALSE),
    COALESCE(up.can_manage_shift_templates,FALSE),
    COALESCE(up.can_manage_schedules,      FALSE),
    COALESCE(up.can_view_attendance,       FALSE),
    COALESCE(up.can_manage_attendance,     FALSE),
    COALESCE(up.can_approve_corrections,   FALSE),
    COALESCE(up.can_manage_leaves,         FALSE),
    COALESCE(up.can_view_reports,          FALSE),
    COALESCE(up.can_view_payroll,          FALSE),
    COALESCE(up.can_manage_payroll,        FALSE),
    COALESCE(up.can_view_salary,           FALSE),
    COALESCE(up.can_manage_company,        FALSE),
    COALESCE(up.can_manage_settings,       FALSE),
    COALESCE(up.can_manage_users,          FALSE),
    COALESCE(up.can_manage_roles,          FALSE),
    COALESCE(up.can_view_audit_logs,       FALSE),
    COALESCE(up.can_impersonate,           FALSE)
  FROM (VALUES (
    NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
    NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
    NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
    NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
    NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
    NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
    NULL::BOOLEAN, NULL::BOOLEAN
  )) AS defaults(
    c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,
    c17,c18,c19,c20,c21,c22,c23,c24,c25,c26
  )
  LEFT JOIN public.user_permissions up
    ON up.profile_id = p_user_id
   AND up.company_id = p_company_id;
$$;

-- Grant de ejecución para usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_user_permissions TO authenticated;

COMMENT ON TABLE public.user_permissions IS
  'Norma Gestor360 v2.0: Permisos granulares por usuario por empresa. DENY BY DEFAULT.';
