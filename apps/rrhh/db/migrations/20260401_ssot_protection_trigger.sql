-- Migration: SSOT Protection Trigger ("Capa de Hierro")
-- Protege la integridad de los datos sincronizados desde RRHH.

-- 1. Asegurar columna 'position' para usuarios externos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS position TEXT;

-- 2. Función de validación SSOT con Bypass para Propietarios (Lic. Castillo Standard)
CREATE OR REPLACE FUNCTION public.check_profile_ssot_integrity()
RETURNS TRIGGER AS $$
DECLARE
    is_owner_bypass BOOLEAN;
BEGIN
    -- Verificamos si el ejecutor (auth.uid()) tiene rango de 'owner' en la tabla de membresías
    SELECT EXISTS (
        SELECT 1 FROM public.company_memberships 
        WHERE user_id = auth.uid() 
        AND role = 'owner'
        AND is_active = true
    ) INTO is_owner_bypass;

    -- Si es Owner, se permite la edición libre de campos bloqueados por SSOT (Llave Maestra)
    IF (is_owner_bypass) THEN
        RETURN NEW;
    END IF;

    -- Lógica Estándar: Si el perfil está ligado a un empleado, no se permite cambiar el nombre ni el cargo manualmente.
    IF (OLD.linked_employee_id IS NOT NULL) THEN
        IF (NEW.full_name <> OLD.full_name) OR (COALESCE(NEW.position, '') <> COALESCE(OLD.position, '')) THEN
            RAISE EXCEPTION 'SSOT Violation: Solo un Propietario (Owner) puede modificar el nombre o el cargo de un perfil vinculado a RRHH.'
            USING ERRCODE = 'P0001';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-crear el Trigger
DROP TRIGGER IF EXISTS tr_profiles_ssot_protection ON public.profiles;
CREATE TRIGGER tr_profiles_ssot_protection
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_ssot_integrity();
