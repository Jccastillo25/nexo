-- Migration for Antigravity v2.0 Blueprint

-- Add icon_name to job_positions for graphical rendering
ALTER TABLE public.job_positions
ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'briefcase';
