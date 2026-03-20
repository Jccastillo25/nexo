CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'on_time',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.attendance_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.attendance_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.attendance_logs FOR UPDATE USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.absence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.absence_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.absence_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.absence_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.absence_logs FOR UPDATE USING (auth.role() = 'authenticated');
