-- Configuración del propio SaaS (Ruta360), independiente de cualquier
-- empresa. Fila única (singleton) mediante CHECK (id = 1).
CREATE TABLE public.platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  product_name VARCHAR(100) NOT NULL DEFAULT 'Ruta360',
  logo_url VARCHAR(512),
  copyright_text VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.platform_settings (id, product_name, copyright_text)
VALUES (1, 'Ruta360', '© 2026 Ruta360. Todos los derechos reservados.');

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Lectura pública: hasta un visitante sin sesión (pantallas de login) debe
-- poder ver el nombre y logo de la plataforma.
CREATE POLICY platform_settings_select_all ON public.platform_settings
  FOR SELECT
  USING (true);

-- Nada de INSERT/UPDATE/DELETE por RLS: la escritura se hace exclusivamente
-- vía Route Handler con service_role, gateado por platform_admins.

-- Bucket público para el logo de la plataforma (distinto del de logos de
-- cada empresa). Solo escribible por platform_admins.
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true);

CREATE POLICY platform_assets_platform_admin_all ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'platform-assets'
    AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'platform-assets'
    AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );
