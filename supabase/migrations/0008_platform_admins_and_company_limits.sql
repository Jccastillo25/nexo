-- Super Admin: operadores de la plataforma Ruta360, independientes de
-- cualquier empresa (por eso es una tabla separada de public.users,
-- no un valor mas de user_role).
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Cada quien solo puede verificar su propia membresía (usado por el
-- proxy para decidir si mostrar /super-admin). Nadie puede agregarse
-- a si mismo: el alta se hace manualmente, fuera de la app.
CREATE POLICY platform_admins_select_own ON public.platform_admins
  FOR SELECT
  USING (user_id = auth.uid());

-- Cupo de usuarios y estado de la empresa, controlados solo por el Super Admin.
ALTER TABLE public.companies
  ADD COLUMN max_users INT,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Si la empresa está inactiva, sus usuarios pierden acceso a TODO lo que
-- dependa de estas funciones (es decir, prácticamente todas las policies
-- del sistema), sin tener que tocar cada policy una por una.
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.company_id
  FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.id = auth.uid() AND c.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.id = auth.uid() AND c.is_active = true;
$$;
