-- Actualización de Política RLS para búsqueda de empleados
-- Objetivo: Permitir que un administrador busque empleados de cualquier empresa donde tenga membresía activa.

DROP POLICY IF EXISTS "employees_unified_access" ON employees;

CREATE POLICY "employees_unified_access" ON employees
FOR ALL
TO public
USING (
    company_id IN (
        SELECT m.company_id
        FROM company_memberships m
        WHERE m.user_id = auth.uid()
          AND m.is_active = true
    )
);

-- Nota: Esta política ya existía en una forma similar, pero nos aseguramos de que sea ALL 
-- para permitir SELECT en el buscador y el guardado híbrido.
