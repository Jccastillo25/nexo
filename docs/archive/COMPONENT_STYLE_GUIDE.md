# 🎨 Guía de Estilo de Componentes de Navegación

**Versión**: 2.0
**Actualizado**: 2026-03-24
**Tema**: Consolidación de Tabs y Navegación

---

## 📋 Componentes de Navegación por Pestañas

### 1️⃣ TabsInternal - Para Navegación Interna con Estado

#### Descripción
Componente reutilizable para tabs gestionados con estado local. Ideal para formularios, wizards, diálogos modales, o cualquier lugar donde el estado de los tabs sea **local a ese componente**.

#### Importación
```tsx
import { TabsInternal } from '@/components/ui/TabsInternal'
```

#### Props
```typescript
interface TabsInternalProps {
  tabs: Array<{ id: string; label: string }>
  activeTab: string                           // ID del tab activo
  onTabChange: (tabId: string) => void       // Callback cuando cambia el tab
  className?: string                          // Clases adicionales (Tailwind)
  variant?: 'default' | 'light' | 'dark'     // Esquema de color
}
```

#### Ejemplo de Uso
```tsx
'use client'

import { useState } from 'react'
import { TabsInternal } from '@/components/ui/TabsInternal'

export function EmployeeEditForm() {
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'identification', label: 'Identificación' },
    { id: 'address', label: 'Ubicación' },
    { id: 'photo', label: 'Foto' },
    { id: 'security', label: 'Seguridad' },
  ]

  return (
    <form>
      <TabsInternal
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="default"
        className="mb-6"
      />

      {/* Contenido condicional por tab */}
      {activeTab === 'general' && <GeneralSection />}
      {activeTab === 'identification' && <IdentificationSection />}
      {/* ... etc */}
    </form>
  )
}
```

#### Variantes de Color
```typescript
// default: Gris oscuro activo, gris claro inactivo (para fondo blanco)
variant="default"

// light: Gris más suave (para fondos blancos con menos contraste)
variant="light"

// dark: Blanco activo, gris claro inactivo (para fondos oscuros)
variant="dark"
```

#### Ejemplo Visual
```
variant="default"
┌─ General ─┬─ Identificación ─┬─ Ubicación ─┐
└───────────┴─────────────────┴─────────────┘

variant="dark"
┌─ General ─┬─ Identificación ─┬─ Ubicación ─┐ (blanco sobre fondo oscuro)
└───────────┴─────────────────┴─────────────┘
```

---

### 2️⃣ TabsQueryParam - Para Navegación en URL

#### Descripción
Componente para tabs gestionados mediante query parameters en la URL. Ideal para **vistas de detalle, dashboards, o cualquier lugar donde quieras que los tabs sean compartibles por URL**.

#### Importación
```tsx
import { TabsQueryParam } from '@/components/ui/TabsQueryParam'
```

#### Props
```typescript
interface TabsQueryParamProps {
  tabs: Array<{ id: string; label: string }>
  activeTab: string                           // ID del tab activo (del query param)
  basePath: string                            // Ruta base (ej: /employees/123)
  className?: string                          // Clases adicionales (Tailwind)
  variant?: 'default' | 'light' | 'dark'     // Esquema de color
  paramName?: string                          // Nombre del query param (default: 'tab')
}
```

#### Ejemplo de Uso
```tsx
import { TabsQueryParam } from '@/components/ui/TabsQueryParam'

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'resumen' } = await searchParams

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'contrato', label: 'Contrato' },
    { id: 'timeline', label: 'Línea de Vida' },
  ]

  return (
    <section>
      <TabsQueryParam
        tabs={tabs}
        activeTab={tab}
        basePath={`/employees/${id}`}
        variant="dark"
      />

      {/* Contenido condicional por tab */}
      {tab === 'resumen' && <ResumeSection />}
      {tab === 'contrato' && <ContractSection />}
      {tab === 'timeline' && <TimelineSection />}
    </section>
  )
}
```

#### URLs Generadas
```
Base: /employees/123

Con TabsQueryParam:
- /employees/123?tab=resumen
- /employees/123?tab=contrato
- /employees/123?tab=timeline

Parámetro personalizado:
<TabsQueryParam paramName="section" />
Genera: /employees/123?section=resumen
```

#### Ejemplo Visual
```
URL: /employees/123?tab=contrato

┌─ Resumen ─┬─ Contrato (activo) ─┬─ Línea de Vida ─┐
└───────────┴────────────────────┴────────────────┘
                ↑ border-white text-white (dark variant)
```

---

## 🎨 Sistema de Color

### Paleta Predefinida

#### Variant: `default` (Recomendado para fondos blancos)
```
Activo:    border-slate-900 text-slate-900 (gris muy oscuro)
Inactivo:  border-transparent text-slate-500 (gris medio)
Hover:     text-slate-700 (gris oscuro)
```

#### Variant: `light` (Para fondos blancos con menos constraste)
```
Activo:    border-slate-800 text-slate-800 (gris oscuro)
Inactivo:  border-transparent text-slate-400 (gris claro)
Hover:     text-slate-600 (gris medio)
```

#### Variant: `dark` (Recomendado para fondos oscuros)
```
Activo:    border-white text-white
Inactivo:  border-transparent text-slate-400 (gris claro)
Hover:     text-slate-300 border-slate-500
```

### Uso de Variantes en Contexto

```tsx
// Sobre fondo blanco (bg-white)
<TabsInternal variant="default" />

// Sobre fondo gris muy claro (bg-slate-50)
<TabsInternal variant="light" />

// Sobre fondo oscuro (bg-slate-900)
<TabsInternal variant="dark" />

// Sobre fondo con gradiente oscuro
<TabsQueryParam variant="dark" />
```

---

## ❌ Lo Que NO Debes Hacer

### ❌ No Duplicar la Lógica de Tabs
```typescript
// ❌ INCORRECTO
const tabClass = (tab: string) => `px-5 py-3 ${activeTab === tab ? 'active' : ''}`

<button onClick={() => setActiveTab('tab1')}>Tab 1</button>
```

### ✅ Correcto
```typescript
// ✅ CORRECTO
import { TabsInternal } from '@/components/ui/TabsInternal'

<TabsInternal
  tabs={[{ id: 'tab1', label: 'Tab 1' }]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

---

### ❌ No Mezcles Patrones
```typescript
// ❌ INCORRECTO
// Usar TabsInternal para compartir URL
const [tab, setTab] = useState('general')
<TabsInternal activeTab={tab} onTabChange={setTab} />
// ... pero la URL no cambia
```

### ✅ Correcto
```typescript
// ✅ CORRECTO
// Usar TabsQueryParam para compartir URL
<TabsQueryParam activeTab={tab} basePath={currentPath} />
// La URL automáticamente refleja el estado
```

---

### ❌ No Crees Variantes Personalizadas
```typescript
// ❌ INCORRECTO
className="px-5 py-3 border-b-2 border-my-custom-color text-my-custom-text"
```

### ✅ Correcto
```typescript
// ✅ CORRECTO - Usa una variante existente
variant="default"  // o "light" o "dark"

// Si necesitas una variante diferente, agrega a getTabClass()
```

---

## 📱 Responsividad

Ambos componentes son **completamente responsive** por defecto.

```tsx
// Automáticamente responsive
<TabsInternal
  className="overflow-x-auto -mx-6 px-6 hide-scrollbar"
/>

// En móviles: scroll horizontal
// En desktop: todos los tabs visibles
```

### Clases Tailwind Útiles
```tsx
// Scroll horizontal en móviles
className="overflow-x-auto -mx-6 px-6"

// Ocultar scrollbar (personalizado en CSS)
className="hide-scrollbar"

// Mejorar usabilidad en móviles
className="sm:px-0"
```

---

## ♿ Accesibilidad

Ambos componentes incluyen **atributos ARIA** por defecto:

```html
<!-- Componente renderizado -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="tab-panel">
    Active Tab
  </button>
  <button role="tab" aria-selected="false" aria-controls="tab-panel">
    Inactive Tab
  </button>
</div>
```

### Características de Accesibilidad
- ✅ Roles ARIA correctos (`tablist`, `tab`)
- ✅ `aria-selected` indica estado activo
- ✅ `aria-controls` vincula con contenido
- ✅ Navegación con teclado (Click/Enter)

### Mejoras Futuras
- ⏳ Navegación con Arrow Keys
- ⏳ Soporte para tecla Home/End
- ⏳ Anuncio de cambios con ARIA Live

---

## 📐 Espaciado y Dimensiones

### Tamaños Predefinidos
```typescript
// Padding
px-5 py-3  // Horizontal: 1.25rem, Vertical: 0.75rem

// Ancho de línea inferior (border-b)
border-b-2 // 2px de espesor

// Tamaño de texto
text-sm    // 0.875rem (14px)

// Peso de fuente
font-semibold // 600
```

### Personalizando Espaciado
```tsx
// Para tabs más grandes
<TabsInternal className="px-6 py-4 text-base" />

// Para tabs más compactos
<TabsInternal className="px-3 py-2 text-xs" />
```

---

## 🔗 Casos de Uso Recomendados

### TabsInternal ✅
- ✅ Formularios de múltiples secciones
- ✅ Wizards (pasos)
- ✅ Diálogos modales con múltiples vistas
- ✅ Paneles de configuración
- ✅ Carruseles/galerías internas
- ✅ Content dentro de componentes cerrados

### TabsQueryParam ✅
- ✅ Páginas de detalle de recursos
- ✅ Dashboards de monitoreo
- ✅ Vistas exploratorias
- ✅ Reportes (diferentes vistas del mismo reporte)
- ✅ Galerías públicas/compartibles
- ✅ Documentación con múltiples secciones

---

## 🚀 Ejemplo Completo

### Formulario de Empleado (TabsInternal)
```tsx
'use client'

import { useState } from 'react'
import { TabsInternal } from '@/components/ui/TabsInternal'

export function CompleteEmployeeForm({ employee }) {
  const [activeTab, setActiveTab] = useState('personal')

  const tabs = [
    { id: 'personal', label: 'Información Personal' },
    { id: 'documents', label: 'Documentos' },
    { id: 'employment', label: 'Empleo' },
    { id: 'compensation', label: 'Compensación' },
  ]

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h1 className="mb-6 text-2xl font-bold">Editar Empleado</h1>

      <TabsInternal
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-8"
      />

      <form className="space-y-6">
        {activeTab === 'personal' && <PersonalSection />}
        {activeTab === 'documents' && <DocumentsSection />}
        {activeTab === 'employment' && <EmploymentSection />}
        {activeTab === 'compensation' && <CompensationSection />}

        <div className="flex gap-2 border-t pt-6">
          <button type="submit" className="btn btn-primary">
            Guardar
          </button>
          <button type="button" className="btn btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

### Página de Detalle (TabsQueryParam)
```tsx
import { TabsQueryParam } from '@/components/ui/TabsQueryParam'
import { ResumeSection, ContractSection, TimelineSection } from './sections'

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'resume' } = await searchParams
  const employee = await fetchEmployee(id)

  const tabs = [
    { id: 'resume', label: 'Resumen' },
    { id: 'contract', label: 'Contrato' },
    { id: 'timeline', label: 'Línea de Vida' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-3xl font-bold">{employee.name}</h1>
      </div>

      {/* Tabs */}
      <TabsQueryParam
        tabs={tabs}
        activeTab={tab}
        basePath={`/employees/${id}`}
        variant="dark"
      />

      {/* Content */}
      {tab === 'resume' && <ResumeSection employee={employee} />}
      {tab === 'contract' && <ContractSection employee={employee} />}
      {tab === 'timeline' && <TimelineSection employee={employee} />}
    </div>
  )
}
```

---

## 📞 Preguntas Frecuentes

### ¿Qué componente debo usar?
- **¿Necesitas compartir la URL?** → `TabsQueryParam`
- **¿Es estado local?** → `TabsInternal`

### ¿Cómo cambio los colores de los tabs?
1. Usa `variant="light"` o `variant="dark"`
2. Si necesitas colores completamente diferentes, edita `getTabClass()` en el componente

### ¿Puedo agregar iconos a los tabs?
Sí, modifica la estructura de `tabs` en tu página:
```tsx
const tabs = [
  { id: 'home', label: '🏠 Inicio' },
  { id: 'settings', label: '⚙️ Configuración' },
]
```

### ¿Puedo deshabilitar un tab?
Actualmente no, pero es una mejora futura planeada. Mientras tanto, puedes:
```tsx
<TabsInternal
  tabs={tabs.map(t => ({
    ...t,
    label: t.disabled ? `${t.label} (disabled)` : t.label
  }))}
  onTabChange={(id) => {
    const tab = tabs.find(t => t.id === id)
    if (!tab?.disabled) setActiveTab(id)
  }}
/>
```

---

## 📚 Recursos

- `src/components/ui/TabsInternal.tsx` — Código fuente
- `src/components/ui/TabsQueryParam.tsx` — Código fuente
- `CONSOLIDATION_SUMMARY.md` — Resumen del proyecto

---

**Última actualización**: 2026-03-24
**Versión**: 2.0
**Autor**: Claude (AI Assistant)

