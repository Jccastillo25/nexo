# Guía de contribución — Gestor360

Esta guía define los estándares y convenciones para contribuir al proyecto.

---

## Flujo de trabajo con Git

### Nombres de ramas

| Tipo          | Formato                          | Ejemplo                       |
|---------------|----------------------------------|-------------------------------|
| Nueva función | `feature/nombre-descriptivo`     | `feature/filtro-attendance`   |
| Corrección    | `fix/descripcion-del-bug`        | `fix/pin-collision-on-create` |
| Hotfix        | `hotfix/descripcion`             | `hotfix/login-redirect`       |
| Mejora técnica| `chore/descripcion`              | `chore/update-supabase-ssr`   |

### Commits

Usa el formato [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(ámbito): descripción corta en español

[cuerpo opcional]

[footer opcional]
```

**Tipos válidos:**
- `feat` — nueva funcionalidad
- `fix` — corrección de bug
- `chore` — tareas de mantenimiento (deps, config)
- `docs` — cambios en documentación
- `style` — cambios de formato sin afectar lógica
- `refactor` — refactoring sin cambio de comportamiento
- `test` — adición o corrección de tests

**Ejemplos:**
```
feat(employees): agregar campo national_id al formulario de edición
fix(kiosk): corregir generación duplicada de device_code
docs(README): actualizar sección de variables de entorno
```

---

## Estructura de código

### Server Actions

Todos los Server Actions deben estar en `app/actions/` y seguir este patrón:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = { error: string } | null

export async function miAccion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()

  // 1. Obtener y validar campos del formulario
  const campo = formData.get('campo') as string
  if (!campo) return { error: 'El campo es requerido.' }

  // 2. Verificar sesión del usuario si es necesario
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No tienes una sesión activa.' }

  // 3. Operación de base de datos
  const { error } = await supabase.from('tabla').insert({ campo })
  if (error) return { error: error.message }

  // 4. Revalidar caché y redirigir
  revalidatePath('/ruta')
  redirect('/ruta')
}
```

### Páginas (Server Components)

Las páginas deben ser `async` y usar directamente el cliente de Supabase:

```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MiPagina() {
  const supabase = await createClient()
  const { data } = await supabase.from('tabla').select('*')

  return <div>{/* JSX */}</div>
}
```

### Client Components

Solo usar `'use client'` cuando sea estrictamente necesario:
- Hooks de React (`useState`, `useEffect`, `usePathname`)
- Event listeners del DOM
- Librerías de gráficas (Recharts)
- Interacciones de sidebar/topbar

---

## Estilos y diseño

### Variables CSS

El sistema de diseño usa CSS Variables definidas en `app/globals.css`. **No usar colores hardcodeados**; referenciar las variables del tema:

```css
/* ✅ Correcto */
color: var(--text-strong);
background: var(--sidebar-bg);
border-color: var(--border-soft);

/* ❌ Evitar */
color: #1a1a2e;
background: #ffffff;
```

### Variables disponibles

| Variable              | Uso                                        |
|-----------------------|--------------------------------------------|
| `--primary`           | Color de acento principal                  |
| `--sidebar-bg`        | Fondo del sidebar                          |
| `--sidebar-text`      | Texto en sidebar                           |
| `--sidebar-active-bg` | Fondo de item activo en sidebar            |
| `--sidebar-active-text` | Texto de item activo                     |
| `--sidebar-icon`      | Color de iconos en sidebar                 |
| `--text-strong`       | Texto principal / titulares                |
| `--text-muted`        | Texto secundario                           |
| `--text-light`        | Texto terciario / labels                   |
| `--border-soft`       | Bordes sutiles                             |
| `--border-medium`     | Bordes de separación                       |

### Tailwind CSS

Se usa Tailwind v4. Para estilos específicos de layout o responsive, usar clases de Tailwind. Para el sistema de colores y tema, usar CSS Variables. Se recomienda el uso de `@tailwindcss/postcss` para la integración.

---

## Seguridad / Row Level Security (RLS)

- Todas las tablas deben tener **RLS habilitado** en Supabase.
- El acceso se limita según el `company_id` del usuario autenticado (vía `company_memberships`).
- Toda marcación de asistencia debe realizarse a través de las funciones RPC (`rpc_mark_attendance_action`) para garantizar la integridad y auditoría.
- Los Server Actions verifican la sesión antes de cualquier operación sensible.
- Los datos del cliente **solo** deben acceder con la `anon key`, nunca con la `service_role key`.

---

## Verificación antes de hacer push

```bash
# Verificar linting
npm run lint

# Verificar build (opcional pero recomendado)
npm run build
```

Asegúrate de que no haya errores de TypeScript ni de ESLint antes de hacer push.

---

## Módulos en desarrollo

Los siguientes módulos están en construcción y usan el componente `<ModulePlaceholder>`:
- Reportes (subpáginas)
- Seguridad
- Configuración
- Algunas vistas del Kiosco

Si trabajas en uno de estos módulos, reemplaza el `ModulePlaceholder` con la implementación real al completar el módulo.

---

*Guía de contribución — Gestor360 v0.2.0 — 24 de marzo de 2026*
