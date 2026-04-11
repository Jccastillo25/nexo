# 🛡️ SECURITY MAP - Gestor360 Administrative Module

Este documento detalla la arquitectura de seguridad y el control de acceso del módulo administrativo, basado en el principio de **Single Source of Truth (SSOT)** y la política de **Deny by Default**.

## 1. Arquitectura de Permisos

El sistema utiliza un modelo de Control de Acceso Basado en Atributos (ABAC) simplificado, donde cada usuario tiene una matriz de permisos vinculada a su perfil y a una empresa específica.

### Jerarquía de Roles
1. **OWNER**: Acceso total e ilimitado. Puede editar campos SSOT protegidos.
2. **ADMIN**: Gestión operativa. Sujeto a restricciones SSOT (no puede editar campos que vienen de RRHH).

## 2. Manifiesto de Recursos (`permissions-manifest.json`)

Todas las rutas dentro de `app/(admin)/` DEBEN estar registradas en el manifiesto para ser accesibles. Si una ruta no existe en el manifiesto, el sistema denegará el acceso por defecto.

| Recurso ID | Ruta | Descripción |
| :--- | :--- | :--- |
| `admin_dashboard` | `/dashboard` | Centro de Control / KPIs |
| `admin_security` | `/security` | Gestión de usuarios y permisos |
| `admin_employees` | `/hr/employees` | Listado de colaboradores (SSOT) |
| ... | ... | ... |

## 3. Matriz de KPIs (Centro de Control)

Los permisos de visualización en el Dashboard son granulares:

- `can_view_kpis_talent`: Estadísticas de personal y distribución.
- `can_view_kpis_attendance`: Métricas de puntualidad, asistencia y actividad en tiempo real.
- `can_view_kpis_financial`: Costos de nómina y horas extras.
- `can_view_kpis_hardware`: Estado de salud de los Kioskos de marcación.

## 4. Política de "Deny by Default"

Cualquier nuevo módulo o componente sensible debe implementar la validación de permiso antes del renderizado o ejecución:

```typescript
const { can_view_kpis_financial } = permissions;
if (!can_view_kpis_financial) return <AccessDenied />;
```

## 5. Auditoría de Credenciales

- Las contraseñas NUNCA se almacenan en texto plano.
- Se utiliza Hashing irreversibles (Bcrypt/Argon2) gestionado por Supabase Auth.
- El administrador solo puede "Sobrescribir" la clave, nunca recuperarla.

## 6. Integridad de Datos en Cliente

Para evitar errores de tipado o inyección de metadatos en el cliente, el sistema aplica un filtrado estricto en el servidor (`AdminShell`) antes de pasar los permisos al `AdminShellClient`:

- Se eliminan campos no booleanos (`profile_id`, `company_id`, `timestamps`).
- Se garantiza el tipado `Record<string, boolean>`.
- Esto previene fallos en el proceso de build (Vercel) y asegura que el componente de interfaz solo reciba flags de permisos procesables.

---
*Ultima Actualización: 2026-04-12*
