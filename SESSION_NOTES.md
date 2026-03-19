# Notas de Sesión - 19 de Marzo, 2026

## Estado Actual
- **Corrección de Reportes**: Se identificó un problema con la visualización de registros de Bryan debido a políticas RLS en Supabase.
- **Fix Aplicado**: Se ejecutó `fix_bryan.js` para corregir los minutos de tardanza en un registro específico (`eb133986-e1be-41d0-b449-65a4c2379c2a`).
- **RLS**: Se revisó la necesidad de ajustar las políticas de Supabase para permitir a los administradores ver todos los registros sin restricciones de `user_id`.

## Pendientes
- [ ] **Políticas RLS**: Finalizar el ajuste de políticas en Supabase para que el rol `admin` / `rrhh` pueda ver registros de otros empleados en el módulo de reportes.
- [ ] **Cálculo de Tardanza**: Verificar si la lógica de tardanza en el kiosco necesita ajustes adicionales para casos de turnos nocturnos o desfasados.
- [ ] **Dashboard Multi-Empresa**: Continuar con la integración de filtros por empresa en todos los widgets del dashboard.

## Archivos Relevantes
- `web/fix_bryan.js`: Script de emergencia para corrección de datos.
- `web/app/(admin)/reports/page.tsx`: Módulo de reportes en desarrollo.
