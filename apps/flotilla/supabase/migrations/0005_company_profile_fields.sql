-- Perfil de empresa: datos fiscales y logo, editables por el admin de esa empresa.
ALTER TABLE public.companies
  ADD COLUMN ruc VARCHAR(50),
  ADD COLUMN address TEXT,
  ADD COLUMN phone VARCHAR(50),
  ADD COLUMN email VARCHAR(255),
  ADD COLUMN logo_url VARCHAR(512);

CREATE POLICY companies_update_own ON companies
  FOR UPDATE
  USING (id = public.auth_company_id() AND public.auth_role() = 'admin')
  WITH CHECK (id = public.auth_company_id() AND public.auth_role() = 'admin');
