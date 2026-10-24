# 2026-10-23 — Panel de plataforma (super admin): diseño y Paso Cero

- **Subfase:** panel de plataforma en `apps/nexo` ([plan 21](../plan/21-plataforma-empresas.md)), etapa 1 (Paso Cero).
- **Estado:** no existía → Paso Cero **aplicado en `nexo-core`**; esquema, código y pantallas pendientes.
- **Commit:** ninguno (todo en local).

## Pedido y decisiones del usuario (2026-10-22)

"Un panel administrativo dentro de Nexo, panel super admin, para crear una empresa, asignar qué
módulos puede ver esa empresa y cuántos usuarios tiene permitido." Decisiones P1–P5 en el plan 21 §1:

- un usuario puede pertenecer a varias empresas y elige una después del login;
- cada empresa tiene sus propios roles y sus apps activas;
- el super admin puede entrar a cualquier empresa, con auditoría;
- el primer administrador se crea en el mismo alta;
- el cupo cuenta los usuarios activos.

## Verificación remota previa (solo lectura, 2026-10-22)

- Hay 1 empresa, con 4 membresías (1 owner) y 7 apps habilitadas.
- `core.companies` no tiene cupo y no existe ningún concepto de super admin.
- `core.has_permission` no revisa `companies.active`.
- Las tablas de los módulos ya llevan `company_id`.
- **El código es de una sola empresa** (`NEXO_COMPANY_ID` en `packages/auth/empresa.ts`).
- La única función que deduce la empresa con `limit 1` es `update_platform_settings`.
- Ninguna policy RLS consulta `company_memberships` directamente.

## Migración

`20261024033541_nexo_plataforma_permisos_paso_cero`. Inserta 9 códigos `nexo.plataforma.*` (dominio `plataforma`):

- `empresas.ver`, `.crear`, `.editar`, `.desactivar` y `.entrar`;
- `modulos.asignar`;
- `administradores.gestionar`;
- `auditoria.ver`;
- `marca.editar`.

| Chequeo | Antes | Después |
|---|---|---|
| Códigos `nexo.plataforma.%` | 0 | 9 (todos de 4 segmentos) |
| Códigos de `nexo` | 13 | 22 |
| Catálogo total | 210 | 219 |
| Asignados a roles, plantillas o usuarios | — | 0 |

**Advisors de seguridad:** sin hallazgos sobre el catálogo ni sobre los códigos nuevos.

## Deuda y pendientes

- **Transitorio:**
  - el editor de roles de la empresa (`admin_catalogo_permisos`) muestra los 9 códigos;
  - `admin_guardar_rol` los aceptaría.
  - Nada los evalúa todavía, así que no dan acceso. El esquema los excluye.
- **Siguiente:** etapa 2 del plan 21:
  - `core.platform_admins` y `companies.max_usuarios`;
  - el trigger de cupo;
  - `has_permission` con empresa inactiva y super admin;
  - las RPC `plataforma_*`, `mis_empresas` y `entrar_empresa`.
  - Se ensaya en una transacción revertida y necesita la aprobación del usuario.
- La etapa 3 (empresa activa por cookie en lugar de `NEXO_COMPANY_ID`) toca las 6 zonas y se despliega junta.
