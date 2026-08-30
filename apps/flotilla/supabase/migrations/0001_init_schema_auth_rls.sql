-- =====================================================================
-- FASE 1 — SaaS Control Operativo de Transporte (MVP)
-- Base de Datos (DDL) + Autenticación nativa Supabase + RLS multi-tenant
-- Fuente: MVP_SaaS_Control_Transporte_Especificacion_Tecnica.pdf, Sección 4
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EMPRESAS (Multi-tenant Foundation)
-- ---------------------------------------------------------------------
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. USUARIOS (Admin & Drivers)
-- Conectada al sistema de Auth nativo de Supabase: el id de esta tabla
-- ES el mismo id de auth.users (relación 1 a 1). Por eso se retira
-- password_hash del DDL original: Supabase Auth ya gestiona y resguarda
-- el hash de contraseña en auth.users; duplicarlo aquí sería redundante
-- e inseguro (dos fuentes de verdad para credenciales).
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'driver');

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'driver',
  pin_code VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 3. VEHÍCULOS
-- ---------------------------------------------------------------------
CREATE TYPE vehicle_status AS ENUM ('active', 'maintenance', 'inactive');

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  license_plate VARCHAR(20) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  current_odometer INT NOT NULL DEFAULT 0,
  status vehicle_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_plate_per_company UNIQUE (company_id, license_plate)
);

-- ---------------------------------------------------------------------
-- 4. CATÁLOGO DE ACCESORIOS Y ASIGNACIÓN BASE
-- ---------------------------------------------------------------------
CREATE TABLE accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE vehicle_accessories (
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  accessory_id UUID REFERENCES accessories(id) ON DELETE CASCADE,
  PRIMARY KEY (vehicle_id, accessory_id)
);

-- ---------------------------------------------------------------------
-- 5. VIAJES (Cabecera del Viaje)
-- ---------------------------------------------------------------------
CREATE TYPE trip_status AS ENUM (
  'created', 'inspected', 'in_transit', 'at_destination',
  'unloading', 'unloading_completed', 'completed', 'cancelled'
);

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  status trip_status NOT NULL DEFAULT 'created',
  start_odometer INT NOT NULL,
  end_odometer INT,
  start_odometer_photo_url VARCHAR(512) NOT NULL,
  end_odometer_photo_url VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT check_odometers CHECK (end_odometer IS NULL OR end_odometer >= start_odometer)
);

-- ---------------------------------------------------------------------
-- 6. REGISTRO INMUTABLE DE EVENTOS (Append-Only Log)
-- ---------------------------------------------------------------------
CREATE TYPE trip_event_type AS ENUM (
  'start_trip', 'arrival_destination', 'start_unloading',
  'end_unloading', 'finish_trip'
);

CREATE TABLE trip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  event_type trip_event_type NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  gps_accuracy DECIMAL(6, 2),
  synced_offline BOOLEAN DEFAULT FALSE
);

-- ---------------------------------------------------------------------
-- 7. INSPECCIÓN PREVIA Y AUDITORÍA DE ACCESORIOS
-- ---------------------------------------------------------------------
CREATE TABLE trip_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES accessories(id),
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  has_damage BOOLEAN NOT NULL DEFAULT FALSE,
  issue_description TEXT,
  issue_photo_url VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- FUNCIONES AUXILIARES PARA RLS
-- SECURITY DEFINER: evitan recursión de RLS al consultar public.users
-- desde dentro de las propias políticas de public.users.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_inspections ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- companies: solo lectura de la propia empresa.
-- La creación de companies + primer admin se hace server-side con la
-- service_role key (bootstrap de tenant), fuera del alcance de RLS.
-- ---------------------------------------------------------------------
CREATE POLICY companies_select_own ON companies
  FOR SELECT
  USING (id = public.auth_company_id());

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE POLICY users_select_same_company ON users
  FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY users_insert_admin_only ON users
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() = 'admin'
  );

CREATE POLICY users_update_admin_or_self ON users
  FOR UPDATE
  USING (
    company_id = public.auth_company_id()
    AND (public.auth_role() = 'admin' OR id = auth.uid())
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND (public.auth_role() = 'admin' OR id = auth.uid())
  );

CREATE POLICY users_delete_admin_only ON users
  FOR DELETE
  USING (
    company_id = public.auth_company_id()
    AND public.auth_role() = 'admin'
  );

-- ---------------------------------------------------------------------
-- vehicles: lectura para toda la empresa (el conductor debe poder
-- listar/elegir unidad); alta/edición/baja restringida a admin.
-- ---------------------------------------------------------------------
CREATE POLICY vehicles_select_same_company ON vehicles
  FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY vehicles_write_admin_only ON vehicles
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_role() = 'admin'
  );

CREATE POLICY vehicles_update_admin_only ON vehicles
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY vehicles_delete_admin_only ON vehicles
  FOR DELETE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- accessories: catálogo de la empresa. Lectura general, gestión admin.
-- ---------------------------------------------------------------------
CREATE POLICY accessories_select_same_company ON accessories
  FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY accessories_insert_admin_only ON accessories
  FOR INSERT
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY accessories_update_admin_only ON accessories
  FOR UPDATE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

CREATE POLICY accessories_delete_admin_only ON accessories
  FOR DELETE
  USING (company_id = public.auth_company_id() AND public.auth_role() = 'admin');

-- ---------------------------------------------------------------------
-- vehicle_accessories: sin company_id propio, se filtra vía el vehículo.
-- ---------------------------------------------------------------------
CREATE POLICY vehicle_accessories_select_same_company ON vehicle_accessories
  FOR SELECT
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE company_id = public.auth_company_id())
  );

CREATE POLICY vehicle_accessories_write_admin_only ON vehicle_accessories
  FOR INSERT
  WITH CHECK (
    public.auth_role() = 'admin'
    AND vehicle_id IN (SELECT id FROM vehicles WHERE company_id = public.auth_company_id())
  );

CREATE POLICY vehicle_accessories_delete_admin_only ON vehicle_accessories
  FOR DELETE
  USING (
    public.auth_role() = 'admin'
    AND vehicle_id IN (SELECT id FROM vehicles WHERE company_id = public.auth_company_id())
  );

-- ---------------------------------------------------------------------
-- trips: el conductor opera sus propios viajes; el admin ve/gestiona
-- todos los de su empresa. Sin política DELETE: un viaje no se borra,
-- se cancela vía status (coherente con auditoría inmutable).
-- ---------------------------------------------------------------------
CREATE POLICY trips_select_same_company ON trips
  FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY trips_insert_own_or_admin ON trips
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_company_id()
    AND (driver_id = auth.uid() OR public.auth_role() = 'admin')
  );

CREATE POLICY trips_update_own_or_admin ON trips
  FOR UPDATE
  USING (
    company_id = public.auth_company_id()
    AND (driver_id = auth.uid() OR public.auth_role() = 'admin')
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND (driver_id = auth.uid() OR public.auth_role() = 'admin')
  );

-- ---------------------------------------------------------------------
-- trip_events: log append-only. Solo SELECT + INSERT (sin UPDATE ni
-- DELETE) para que la inmutabilidad quede garantizada por RLS, no solo
-- por convención de la app.
-- ---------------------------------------------------------------------
CREATE POLICY trip_events_select_same_company ON trip_events
  FOR SELECT
  USING (
    trip_id IN (SELECT id FROM trips WHERE company_id = public.auth_company_id())
  );

CREATE POLICY trip_events_insert_own_trip ON trip_events
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips
      WHERE company_id = public.auth_company_id()
        AND (driver_id = auth.uid() OR public.auth_role() = 'admin')
    )
  );

-- ---------------------------------------------------------------------
-- trip_inspections: evidencia de check-in. Igual que trip_events, solo
-- SELECT + INSERT (registro de un hecho puntual, no editable después).
-- ---------------------------------------------------------------------
CREATE POLICY trip_inspections_select_same_company ON trip_inspections
  FOR SELECT
  USING (
    trip_id IN (SELECT id FROM trips WHERE company_id = public.auth_company_id())
  );

CREATE POLICY trip_inspections_insert_own_trip ON trip_inspections
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips
      WHERE company_id = public.auth_company_id()
        AND (driver_id = auth.uid() OR public.auth_role() = 'admin')
    )
  );
