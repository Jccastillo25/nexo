-- DDL MIGRATION: Jerarquía de Puestos y Monitor Operativo

-- 1. Tabla: job_positions
CREATE TABLE IF NOT EXISTS public.job_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    parent_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL,
    default_break_mins INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users on job_positions" ON public.job_positions FOR ALL TO authenticated USING (true);

-- 2. Tabla: employee_status_logs
CREATE TABLE IF NOT EXISTS public.employee_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time_scheduled TIMESTAMPTZ,
    end_time_actual TIMESTAMPTZ,
    is_complete_override BOOLEAN NOT NULL DEFAULT false,
    authorized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_status_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users on employee_status_logs" ON public.employee_status_logs FOR ALL TO authenticated USING (true);

-- 3. Modificaciones a la tabla employees
DO $$ 
BEGIN 
    -- Agregamos la referencia al puesto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='job_position_id') THEN
        ALTER TABLE public.employees ADD COLUMN job_position_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL;
    END IF;

    -- Agregamos los flag de estado (para el monitor en vivo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='current_status') THEN
        ALTER TABLE public.employees ADD COLUMN current_status TEXT NOT NULL DEFAULT 'offline';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='last_status_change') THEN
        ALTER TABLE public.employees ADD COLUMN last_status_change TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- 4. Opcional: Asegurarnos de que Realtime vigile empleados
-- En el editor SQL de Supabase, puedes intentar correr lo siguiente:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
