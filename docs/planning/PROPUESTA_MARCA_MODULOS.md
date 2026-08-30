# Propuesta de marca, rutas e íconos — Suite de módulos (estilo Odoo)

Complementa a [PLAN_UNIFICACION_NEXO.md](PLAN_UNIFICACION_NEXO.md). Este
documento resuelve tres cosas: cómo se llaman los módulos (sin números ni
nombres inventados), qué ruta usa cada uno dentro del dominio único de la
suite, y qué catálogo de módulos de Odoo/SAP/Oracle conviene adoptar de
forma progresiva.

---

## 1. Investigación: catálogo de módulos en los ERP/CRM líderes

| Categoría | Odoo | SAP S/4HANA | Oracle Fusion Cloud |
|---|---|---|---|
| Finanzas | Contabilidad, Facturación, Gastos, Hoja de cálculo (BI), Firma electrónica | FI (Finanzas), CO (Controlling) | Financials (GL, AP, AR, Activos Fijos, Cash Mgmt) |
| Ventas / CRM | CRM, Ventas, PdV, Suscripciones, Alquiler | SD (Ventas y Distribución) | CX Sales |
| Sitios web | Creador de sitios, eCommerce, Blog, Foro, Chat en vivo, eLearning | — (vía SAP Commerce) | CX Commerce |
| Cadena de suministro | Inventario, Manufactura, PLM, Compras, Mantenimiento, Calidad | MM (Materiales), PP (Producción), WM (Almacén), QM (Calidad), PM (Mantenimiento) | SCM (Planning, Inventory, Manufacturing, Logistics) |
| RRHH | Empleados, Reclutamiento, Vacaciones, Evaluaciones, Referencias, **Flotilla** | HCM (Capital Humano) | HCM (HR, Payroll, Talento, Learning) |
| Marketing | Redes sociales, Email, SMS, Eventos, Encuestas | — | CX Marketing |
| Servicios | Proyectos, Registro de horas, Servicio externo, Soporte, Planeación, Citas | PS (Proyectos) | PPM (Project Portfolio Mgmt) |
| Productividad | Conversaciones, IA, IoT, VoIP, Artículos, WhatsApp | — | — |

Conclusión clave: **los tres coinciden en el mismo núcleo de negocio** —
Finanzas, Ventas/CRM, Cadena de suministro (Inventario/Compras), RRHH,
Proyectos/Servicios. Ese es el orden natural para tu roadmap: no hace falta
copiar los 30+ módulos de Odoo, solo los que le sirven a una distribuidora
de materiales de construcción con flotilla propia.

Fuentes: [Odoo — Gloriumtech](https://gloriumtech.com/the-complete-list-of-odoo-modules-every-module-explained/), [Odoo — Bista Solutions](https://www.bistasolutions.com/resources/blogs/odoo-modules-list/), [SAP S/4HANA — ERP Research](https://www.erpresearch.com/en-us/sap-s/4-hana-modules), [SAP — Simplilearn](https://www.simplilearn.com/sap-modules-sap-fi-sap-co-sap-sd-sap-hcm-and-more-rar111-article), [Oracle Fusion — Redress](https://redresscompliance.com/oracle-fusion-modules-list), [Oracle ERP Cloud — ERP Research](https://www.erpresearch.com/en-us/blog/oracle-erp-cloud-modules-guide)

---

## 2. Naming: se retiran los nombres/números de producto

Hoy: `Gestor360`, `Ruta360` — nombres de producto, cada uno con su propia
identidad. Estilo Odoo: el módulo se llama por su **función**, sin número ni
apodo, y la marca vive únicamente en la suite. Igual que "Empleados" o "CRM"
en Odoo, no "HR360" o "SalesPro".

| Nombre actual | Nuevo nombre de módulo (clásico) | Ícono (Lucide) | Color de acento |
|---|---|---|---|
| Gestor360 | **RRHH** | `users-round` | Ámbar |
| Ruta360 | **Flotilla** | `truck` | Azul |
| CRM (materiales-jcastillo) | **CRM** | `handshake` | Rosa |
| Web Corporativo | *(no es módulo del panel — es el sitio público, la puerta de entrada)* | — | — |

Para los módulos que vienen después (sección 4), mismo criterio: nombre
genérico + un ícono de una sola librería consistente (recomendado:
**Lucide**, ya que es el set que usan shadcn/ui y la mayoría de stacks
Next.js + Tailwind — se ve exactamente como los íconos planos y coloridos
de Odoo si se ponen sobre una tarjeta redondeada con color de fondo por
categoría).

Convención visual de las tarjetas del panel (home tipo Odoo):
- Tarjeta cuadrada redondeada, ícono centrado, un color de fondo pastel por
  categoría (Finanzas = verde, Ventas = rosa, Cadena de suministro = morado,
  RRHH = ámbar, Servicios = índigo) — igual a como Odoo colorea sus títulos
  de categoría en la captura que compartiste.
- Nombre del módulo debajo del ícono, una sola palabra o dos máximo
  ("RRHH", "Flotilla", "CRM", "Inventario"), sin sufijos.

---

## 3. Dominio principal — un solo dominio de app, como Odoo

Odoo real usa exactamente **dos** dominios: `odoo.com` (marketing) y
`mycompany.odoo.com` (la app, un dominio único para todos los módulos, que
viven como rutas: `/odoo/inventory`, `/odoo/crm`, no como subdominios).
Replicamos eso — nada de un subdominio por módulo:

- **`materialesjcastillo.com`** — sitio corporativo público (marketing,
  quiénes somos, catálogo). No requiere login. Único dominio "externo".
- **`nexo.materialesjcastillo.com`** — **la app completa.** Login único en
  la raíz (`/`) → panel con la grilla de módulos → cada módulo es una
  **ruta**, no un subdominio:

| Módulo | Ruta dentro de Nexo |
|---|---|
| Panel (home, grilla de apps) | `nexo.materialesjcastillo.com/` |
| RRHH | `nexo.materialesjcastillo.com/rrhh` |
| Flotilla | `nexo.materialesjcastillo.com/flotilla` |
| CRM | `nexo.materialesjcastillo.com/crm` |
| Inventario *(futuro)* | `nexo.materialesjcastillo.com/inventario` |
| Compras *(futuro)* | `nexo.materialesjcastillo.com/compras` |
| Ventas / PdV *(futuro)* | `nexo.materialesjcastillo.com/ventas` |
| Contabilidad *(futuro)* | `nexo.materialesjcastillo.com/contabilidad` |
| Proyectos *(futuro)* | `nexo.materialesjcastillo.com/proyectos` |
| Soporte *(futuro)* | `nexo.materialesjcastillo.com/soporte` |

**Cómo se logra sin fusionar todo el código en una sola app** (mecanismo
técnico, detallado en el plan principal sección 2.1): patrón oficial de
Next.js llamado **Multi-Zones** — cada módulo sigue siendo su propia app,
su propio repo/subcarpeta, su propio deploy de Vercel; la app `nexo` sólo
define un `rewrite` por módulo hacia la URL de despliegue de ese módulo, y
cada módulo fija su `basePath` (`/rrhh`, `/flotilla`, etc.). El visitante
nunca ve la URL real de despliegue, solo `nexo.materialesjcastillo.com/...`.
Como todo vive en un único host, la sesión de Supabase Auth es una cookie
normal de ese dominio — ya no hace falta el truco de cookie compartida
entre subdominios que se había propuesto antes.
Fuente: [Next.js — Guides: Multi-Zones](https://nextjs.org/docs/pages/guides/multi-zones).

---

## 4. Catálogo progresivo de módulos (roadmap de implementación)

Basado en el cruce Odoo/SAP/Oracle de la sección 1, priorizado para una
distribuidora de materiales de construcción con flotilla propia:

### Fase 1 — Ya existe, solo se renombra y migra (ver plan principal)
| Módulo | Equivalente Odoo | Equivalente SAP | Equivalente Oracle |
|---|---|---|---|
| RRHH | `hr` (módulo independiente) | HCM | HCM |
| Flotilla | `fleet` (módulo independiente; Odoo conecta ambos con un módulo puente, `hr_fleet`, solo para asignar vehículo↔empleado) | PM (mantenimiento de flota) | SCM Logistics |
| CRM | `crm` | SD | CX Sales |

### Fase 2 — Alto valor inmediato para el negocio (ferretería/distribución)
| Módulo | Equivalente Odoo | Equivalente SAP | Equivalente Oracle |
|---|---|---|---|
| Inventario | Inventario | MM | SCM Inventory |
| Compras | Compras | MM-PUR | Procurement |
| Ventas / PdV | Ventas, PdV para tiendas | SD | CX Sales |
| Contabilidad | Contabilidad, Facturación | FI | Financials |

### Fase 3 — Consolidación operativa
| Módulo | Equivalente Odoo | Equivalente SAP | Equivalente Oracle |
|---|---|---|---|
| Proyectos | Proyectos, Registro de horas | PS | PPM |
| Mantenimiento | Mantenimiento | PM | SCM Maintenance |
| Soporte | Soporte al cliente, Citas | — | CX Service |
| Documentos | Documentos, Firma electrónica | — | — |

### Fase 4 — Crecimiento (marketing/digital, cuando se retome ese frente)
| Módulo | Equivalente Odoo | Equivalente SAP | Equivalente Oracle |
|---|---|---|---|
| Marketing | Redes sociales, Email, SMS | — | CX Marketing |
| Sitio Web / eCommerce | Creador de sitios, eCommerce | — | CX Commerce |

Cada módulo de Fase 2-4 se construye como una app nueva en `apps/` dentro
del monorepo, siguiendo exactamente el mismo patrón que RRHH/Flotilla/CRM:
propia ruta bajo `nexo.materialesjcastillo.com` (vía Multi-Zones), propio
schema en `nexo-core`, permisos registrados en `core.user_permissions` bajo
el dominio "Módulos" (norma v3.0).

---

## 5. Convención de manifest por módulo (inspirada en `__manifest__.py` de Odoo)

En [`addons/`](https://github.com/odoo/odoo/tree/master/addons) cada módulo
de Odoo se declara con un manifest: nombre, categoría, ícono, versión y de
qué otros módulos depende (así resuelve el orden de instalación y qué
aparece en el panel). Adoptamos el mismo mecanismo, versión Next.js/JSON:

```jsonc
// apps/flotilla/manifest.json
{
  "slug": "flotilla",
  "nombre": "Flotilla",
  "categoria": "Cadena de suministro",
  "icono": "truck",
  "color": "azul",
  "ruta": "/flotilla",
  "depends": []           // ej. "rrhh_flotilla" dependería de ["rrhh", "flotilla"]
}
```

Un script de CI sincroniza estos manifests hacia `core.apps` (la tabla que
alimenta la grilla del panel) en cada deploy — así el panel nunca se
actualiza a mano, igual que instalar una app en Odoo la hace aparecer sola
en el home. Este manifest es también el lugar natural para declarar, más
adelante, módulos puente entre dos apps (equivalente a `hr_fleet`) sin
mezclar su código dentro de ninguno de los dos módulos base.

---

## 6. Nombre de la suite: **Nexo**

Decisión tomada (2026-08-29): la suite se llama **Nexo** — el punto de
conexión entre todos los módulos, sin ligarse a un solo rubro del negocio
(a diferencia de "Andamio", que solo tenía sentido para materiales de
construcción; Nexo funciona igual de bien si mañana se agrega un módulo que
no tenga nada que ver con construcción).

Aplicado al mapa de rutas de la sección 3:

- Dominio único de la app: **`nexo.materialesjcastillo.com`**
- Nombre visible en login / topbar del panel: **Nexo**
- Las rutas de cada módulo (`/rrhh`, `/flotilla`, `/crm`, etc.) **no
  cambian** — siguen siendo nombres clásicos de función, sin la palabra
  "Nexo" delante, igual que en Odoo un módulo se llama "CRM" y la URL es
  `/odoo/crm`, no `/odoo/OdooCRM`.
- En `core.apps` (tabla del panel) el campo `nombre_suite` = `Nexo`, usado
  solo en el layout del panel (logo, título de pestaña, footer), no en cada
  módulo individual.
- El repo/monorepo pasa a llamarse `nexo` (ver ajuste en
  [PLAN_UNIFICACION_NEXO.md](PLAN_UNIFICACION_NEXO.md), que se actualiza
  en consecuencia: `ct360-core` → `nexo-core`, `apps/hub` → panel de Nexo).
