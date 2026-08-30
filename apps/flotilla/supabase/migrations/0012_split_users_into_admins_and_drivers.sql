-- Separación total de identidades: administradores y conductores dejan
-- de compartir una tabla `users` con columna `role` y pasan a vivir en
-- dos tablas independientes, mismo principio que platform_admins
-- (nunca se mezclan, van a paneles distintos).

-- ---------------------------------------------------------------------
-- 1. Tablas nuevas
-- ---------------------------------------------------------------------
CREATE TABLE public.admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  full_name VARCHAR NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.drivers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  full_name VARCHAR NOT NULL,
  username VARCHAR NOT NULL,
  pin_code VARCHAR(4) NOT NULL CHECK (pin_code ~ '^[0-9]{4}$'),
  national_id VARCHAR NOT NULL,
  license_number VARCHAR,
  license_type VARCHAR,
  license_expiry DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- username: identificador de login por PIN, único en toda la plataforma
-- (el login no conoce la empresa todavía cuando se busca por username).
CREATE UNIQUE INDEX drivers_username_unique_idx ON public.drivers (lower(username));
-- pin_code: único solo dentro de la empresa (se resuelve junto al username).
CREATE UNIQUE INDEX drivers_pin_per_company_idx ON public.drivers (company_id, pin_code);
CREATE UNIQUE INDEX admins_email_unique_idx ON public.admins (lower(email));
CREATE UNIQUE INDEX drivers_email_unique_idx ON public.drivers (lower(email));

-- ---------------------------------------------------------------------
-- 2. Catálogo de categorías de licencia (por empresa) + asignación N:M
-- ---------------------------------------------------------------------
CREATE TABLE public.license_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.driver_license_categories (
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.license_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (driver_id, category_id)
);

-- ---------------------------------------------------------------------
-- 3. Migrar filas existentes de public.users
-- ---------------------------------------------------------------------
INSERT INTO public.admins (id, company_id, email, full_name, is_active, created_at)
SELECT id, company_id, email, full_name, COALESCE(is_active, true), created_at
FROM public.users WHERE role = 'admin';

-- Conductores existentes: la tabla vieja no tenía nombres/apellidos,
-- usuario, identificación ni licencia. Se rellenan con valores
-- provisionales (username derivado del correo, PIN existente si lo
-- tenía) para que el admin los complete después desde /admin/drivers.
INSERT INTO public.drivers (
  id, company_id, email, first_name, last_name, full_name, username,
  pin_code, national_id, license_expiry, is_active, created_at
)
SELECT
  u.id,
  u.company_id,
  u.email,
  split_part(u.full_name, ' ', 1),
  NULLIF(substring(u.full_name FROM position(' ' IN u.full_name) + 1), ''),
  u.full_name,
  lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_.]', '', 'g')) || '_' || substr(u.id::text, 1, 4),
  lpad((1000 + row_number() OVER (PARTITION BY u.company_id ORDER BY u.id))::text, 4, '0'),
  'PENDIENTE',
  CURRENT_DATE,
  COALESCE(u.is_active, true),
  u.created_at
FROM public.users u
WHERE u.role = 'driver';

UPDATE public.drivers SET last_name = full_name WHERE last_name IS NULL;

-- ---------------------------------------------------------------------
-- 4. trips.driver_id ahora referencia drivers, no la tabla users
-- ---------------------------------------------------------------------
ALTER TABLE public.trips DROP CONSTRAINT trips_driver_id_fkey;
ALTER TABLE public.trips ADD CONSTRAINT trips_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.drivers(id);

-- ---------------------------------------------------------------------
-- 5. Fuera la tabla vieja
-- ---------------------------------------------------------------------
DROP TABLE public.users;

-- ---------------------------------------------------------------------
-- 6. auth_company_id() / auth_role(): resuelven contra admins o
-- drivers, nunca ambas (una fila solo puede existir en una de las dos).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.company_id FROM public.admins a
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.id = auth.uid() AND c.is_active = true
  UNION ALL
  SELECT d.company_id FROM public.drivers d
  JOIN public.companies c ON c.id = d.company_id
  WHERE d.id = auth.uid() AND c.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'admin'::user_role FROM public.admins a
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.id = auth.uid() AND c.is_active = true
  UNION ALL
  SELECT 'driver'::user_role FROM public.drivers d
  JOIN public.companies c ON c.id = d.company_id
  WHERE d.id = auth.uid() AND c.is_active = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.auth_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated;

-- ---------------------------------------------------------------------
-- 7. RLS: admins (solo administradores de la misma empresa)
-- ---------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_select_same_company ON public.admins
  FOR SELECT
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY admins_insert_admin_only ON public.admins
  FOR INSERT
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY admins_update_admin_only ON public.admins
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY admins_delete_admin_only ON public.admins
  FOR DELETE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- 8. RLS: drivers. El admin gestiona todo; el propio conductor solo
-- puede leer su fila (para su header/perfil), nunca escribirla — la
-- edición del perfil de conductor es exclusiva del admin.
-- ---------------------------------------------------------------------
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY drivers_select_same_company_or_self ON public.drivers
  FOR SELECT
  USING (
    (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
    OR id = auth.uid()
  );

CREATE POLICY drivers_insert_admin_only ON public.drivers
  FOR INSERT
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY drivers_update_admin_only ON public.drivers
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY drivers_delete_admin_only ON public.drivers
  FOR DELETE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- 9. license_categories: catálogo de empresa, igual patrón que accessories.
-- ---------------------------------------------------------------------
ALTER TABLE public.license_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY license_categories_select_admin_only ON public.license_categories
  FOR SELECT
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY license_categories_insert_admin_only ON public.license_categories
  FOR INSERT
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY license_categories_update_admin_only ON public.license_categories
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY license_categories_delete_admin_only ON public.license_categories
  FOR DELETE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- 10. driver_license_categories: sin company_id propio, se filtra vía
-- el conductor asignado.
-- ---------------------------------------------------------------------
ALTER TABLE public.driver_license_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY driver_license_categories_select_admin_only ON public.driver_license_categories
  FOR SELECT
  USING (
    public.auth_role() = 'admin'
    AND driver_id IN (SELECT id FROM public.drivers WHERE company_id = public.auth_company_id())
  );

CREATE POLICY driver_license_categories_insert_admin_only ON public.driver_license_categories
  FOR INSERT
  WITH CHECK (
    public.auth_role() = 'admin'
    AND driver_id IN (SELECT id FROM public.drivers WHERE company_id = public.auth_company_id())
  );

CREATE POLICY driver_license_categories_delete_admin_only ON public.driver_license_categories
  FOR DELETE
  USING (
    public.auth_role() = 'admin'
    AND driver_id IN (SELECT id FROM public.drivers WHERE company_id = public.auth_company_id())
  );
