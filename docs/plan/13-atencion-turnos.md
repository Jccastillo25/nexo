# Módulo Atención (turnos de sala de espera) — Paso Cero y diseño (borrador para aprobación)

Fecha: 2026-10-14 · Estado: **Paso Cero (sección 3) aprobado y aplicado a `nexo-core`
el 2026-10-14** (migración `20261014222454_atencion_paso_cero`). Asignación de
sucursales desde Configuración → Usuarios: **aprobada**. Tablas, RPC y
`pg_cron` (sección 4): **aplicados el 2026-10-14** (`20261014224341_atencion_esquema`;
el SQL real es el de la migración). Pantallas: **implementadas 2026-10-14**
(`apps/atencion` + Sucursales en `apps/nexo`, ver
[status-log](../status-log/2026-10-14-atencion-pantallas.md)); app inactiva y sin
proyecto Vercel todavía.
Origen: conversación del usuario con ChatGPT ("Buscar sistema de turnos") +
decisiones de esta sesión. Construye sobre la administración de usuarios y
roles ([plan 12](12-administracion-usuarios-roles.md)).

> **Nombre:** la app se llama **Atención** (`atencion`) para no confundirla con
> `rrhh.asistencia.turnos`, que son los horarios de trabajo de los empleados.
> "Turno" = el número que recibe el cliente. "Atención" = la jornada del empleado.

## 1. Decisiones del usuario (2026-10-14)

| # | Decisión |
|---|---|
| A1 | La numeración de turnos **se reinicia cada día** (por sucursal). |
| A2 | Al entrar al módulo, el usuario pulsa **"Iniciar atención"**; según su **rol** queda en **recepción** o se le **asigna automáticamente el primer puesto libre**. Termina con **"Cerrar atención"**, que libera el puesto. |
| A3 | Si alguien no cierra, la atención **se cierra sola a las 12:00 a. m.** (medianoche). |
| A4 | **Varias sucursales**, cada una con su fila, sus puestos y su numeración; el diseño queda **preparado para sucursales** desde el inicio. |
| A5 | **Cualquier agente** puede llamar fuera de orden (editable después en el rol). |
| A6 | Botones **"Iniciar atención" / "Cerrar atención"**. |

Heredado de la conversación con ChatGPT: recepción registra nombre, teléfono y
número de factura; una sola fila por sucursal; los agentes llaman al
siguiente, repiten, finalizan, marcan ausente o llaman fuera de orden sin que
los demás pierdan su posición; la pantalla pública muestra **solo números y
puestos** (nunca nombres ni teléfonos), los próximos turnos y un área de
entretenimiento; se registran ausencias y llamados fuera de orden.

> **Cambio aprobado por el usuario (2026-10-15), reemplaza lo anterior para
> los turnos llamados:** la pantalla y la voz anuncian "Turno 5, Juan Pérez,
> será atendido por María López en Puesto 2": nombre completo del cliente,
> nombre del agente que llamó y puesto. Los próximos siguen siendo solo
> números; teléfono y factura nunca salen. El usuario aceptó que la RPC
> anónima de la pantalla exponga esos nombres a quien tenga su URL.
> Ver [status-log](../status-log/2026-10-15-atencion-pantalla-nombres.md).
>
> **Ampliado el mismo día:** cada pantalla elige en Configuración qué datos
> (cliente, agente, puesto) muestra y cuáles anuncia por voz. Lo apagado no
> sale de la RPC anónima. Ver
> [status-log](../status-log/2026-10-15-atencion-pantalla-configurable.md).

## 2. Flujo

```text
Usuario inicia sesión → entra a Atención → "Iniciar atención"
  ├─ rol con atencion.recepcion.sesion.iniciar → Recepción de SU sucursal
  ├─ rol con atencion.puesto.sesion.iniciar    → primer puesto libre de SU sucursal
  │                                              (ninguno libre → "No hay puestos libres")
  └─ rol con ambos (ej. supervisor)            → elige Recepción o Puesto
"Cerrar atención" → libera el puesto
00:00 (hora de Nicaragua) → se cierran todas las atenciones abiertas
                            y empieza la numeración del día en 1
```

## 3. Matriz de permisos (Paso Cero)

App `atencion` (el trigger crea `atencion.ver_modulo` al registrarla).

| Código | Etiqueta |
|---|---|
| `atencion.recepcion.sesion.iniciar` | Iniciar atención en recepción |
| `atencion.recepcion.turno.crear` | Registrar cliente y entregar turno |
| `atencion.recepcion.turno.cancelar` | Anular un turno |
| `atencion.puesto.sesion.iniciar` | Iniciar atención en un puesto (asignación automática) |
| `atencion.puesto.turno.llamar` | Llamar al siguiente / repetir llamado |
| `atencion.puesto.turno.llamar_fuera_orden` | Llamar un turno específico fuera de orden |
| `atencion.puesto.turno.finalizar` | Marcar turno como atendido |
| `atencion.puesto.turno.marcar_ausente` | Marcar turno como ausente |
| `atencion.cola.turno.ver` | Ver la fila de espera |
| `atencion.cliente.datos.ver` | Ver teléfono y factura del cliente |
| `atencion.configuracion.puesto.gestionar` | Crear, renombrar y desactivar puestos |
| `atencion.configuracion.sesion.liberar` | Liberar un puesto que quedó ocupado |
| `atencion.configuracion.pantalla.gestionar` | Configurar pantallas y entretenimiento |
| `atencion.reportes.turno.ver` | Reportes de tiempos, ausencias y llamados |

Sucursales (catálogo compartido de la empresa, en la administración de Nexo):

| Código | Etiqueta |
|---|---|
| `nexo.administracion.sucursales.ver` | Ver sucursales |
| `nexo.administracion.sucursales.gestionar` | Crear, editar y desactivar sucursales |

Plantillas (`core.app_roles`, para "Cargar plantilla" en el editor de roles):

| Permiso | Recepción | Agente de atención | Supervisor |
|---|:-:|:-:|:-:|
| `atencion.ver_modulo` | ✓ | ✓ | ✓ |
| `recepcion.sesion.iniciar` | ✓ | | ✓ |
| `recepcion.turno.crear` | ✓ | | ✓ |
| `recepcion.turno.cancelar` | ✓ | | ✓ |
| `puesto.sesion.iniciar` | | ✓ | ✓ |
| `puesto.turno.llamar` | | ✓ | ✓ |
| `puesto.turno.llamar_fuera_orden` | | ✓ | ✓ |
| `puesto.turno.finalizar` | | ✓ | ✓ |
| `puesto.turno.marcar_ausente` | | ✓ | ✓ |
| `cola.turno.ver` | ✓ | ✓ | ✓ |
| `cliente.datos.ver` | ✓ | ✓ | ✓ |
| `configuracion.*` (3) | | | ✓ |
| `reportes.turno.ver` | | | ✓ |

La app se registra **inactiva** y sin habilitar para ninguna empresa: con la
`core.has_permission` vigente nadie la ve hasta su activación, al terminar el módulo.

```sql
-- Paso Cero Atención. Solo catálogo + plantillas; sin tablas.
do $$
begin
  if exists (select 1 from core.apps where slug = 'atencion')
     or exists (select 1 from core.permissions_catalog where module_slug = 'atencion' or code like 'nexo.administracion.sucursales.%')
     or exists (select 1 from core.app_roles where module_slug = 'atencion') then
    raise exception 'precheck: Atención o sucursales ya registradas';
  end if;
end;
$$;

insert into core.apps (slug, name, category, icon, color, route, depends, active)
values ('atencion', 'Atención', 'Servicios', 'ticket', 'teal', '/atencion', '{}', false);

do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'atencion.ver_modulo') then
    raise exception 'el trigger no creó atencion.ver_modulo';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('atencion.recepcion.sesion.iniciar',         'atencion', 'recepcion',     'Iniciar atención en recepción',  'Abrir la recepción de la sucursal para registrar clientes.'),
  ('atencion.recepcion.turno.crear',            'atencion', 'recepcion',     'Entregar turnos',                'Registrar nombre, teléfono y factura y asignar el número.'),
  ('atencion.recepcion.turno.cancelar',         'atencion', 'recepcion',     'Anular turnos',                  'Anular un turno en espera.'),
  ('atencion.puesto.sesion.iniciar',            'atencion', 'puesto',        'Iniciar atención en un puesto',  'Tomar automáticamente el primer puesto libre de la sucursal.'),
  ('atencion.puesto.turno.llamar',              'atencion', 'puesto',        'Llamar turnos',                  'Llamar al siguiente turno o repetir el llamado.'),
  ('atencion.puesto.turno.llamar_fuera_orden',  'atencion', 'puesto',        'Llamar fuera de orden',          'Llamar un turno específico sin respetar el orden.'),
  ('atencion.puesto.turno.finalizar',           'atencion', 'puesto',        'Finalizar turnos',               'Marcar el turno como atendido.'),
  ('atencion.puesto.turno.marcar_ausente',      'atencion', 'puesto',        'Marcar ausentes',                'Marcar que el cliente no se presentó.'),
  ('atencion.cola.turno.ver',                   'atencion', 'cola',          'Ver la fila',                    'Ver los turnos en espera de la sucursal.'),
  ('atencion.cliente.datos.ver',                'atencion', 'cliente',       'Ver datos del cliente',          'Ver teléfono y número de factura del turno.'),
  ('atencion.configuracion.puesto.gestionar',   'atencion', 'configuracion', 'Gestionar puestos',              'Crear, renombrar y desactivar puestos de atención.'),
  ('atencion.configuracion.sesion.liberar',     'atencion', 'configuracion', 'Liberar puestos',                'Cerrar la atención de otro usuario y liberar su puesto.'),
  ('atencion.configuracion.pantalla.gestionar', 'atencion', 'configuracion', 'Gestionar pantallas',            'Configurar pantallas públicas y entretenimiento.'),
  ('atencion.reportes.turno.ver',               'atencion', 'reportes',      'Ver reportes',                   'Tiempos de espera y atención, ausencias y llamados fuera de orden.'),
  ('nexo.administracion.sucursales.ver',        'nexo',     'administracion','Ver sucursales',                 'Ver las sucursales de la empresa.'),
  ('nexo.administracion.sucursales.gestionar',  'nexo',     'administracion','Gestionar sucursales',           'Crear, editar y desactivar sucursales.');

insert into core.app_roles (module_slug, role_key, label, description) values
  ('atencion', 'recepcion',  'Recepción',          'Registra clientes y entrega turnos.'),
  ('atencion', 'agente',     'Agente de atención', 'Atiende en un puesto: llama, finaliza y marca ausentes.'),
  ('atencion', 'supervisor', 'Supervisor',         'Todo el módulo, incluida la configuración y los reportes.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'atencion'
where r.module_slug = 'atencion'
  and (
    r.role_key = 'supervisor'
    or (r.role_key = 'recepcion' and p.code in (
      'atencion.ver_modulo', 'atencion.recepcion.sesion.iniciar', 'atencion.recepcion.turno.crear',
      'atencion.recepcion.turno.cancelar', 'atencion.cola.turno.ver', 'atencion.cliente.datos.ver'))
    or (r.role_key = 'agente' and p.code in (
      'atencion.ver_modulo', 'atencion.puesto.sesion.iniciar', 'atencion.puesto.turno.llamar',
      'atencion.puesto.turno.llamar_fuera_orden', 'atencion.puesto.turno.finalizar',
      'atencion.puesto.turno.marcar_ausente', 'atencion.cola.turno.ver', 'atencion.cliente.datos.ver'))
  );
```

## 4. Modelo de datos previsto (siguiente migración, requiere aprobación aparte)

| Tabla | Tipo | Contenido |
|---|---|---|
| `core.sucursales` | catálogo | Sucursales de la empresa (nombre, dirección, activa, zona horaria `America/Managua`). Compartida por todos los módulos. |
| `core.usuario_sucursales` | catálogo | Sucursal(es) donde trabaja cada usuario (se asigna en Configuración → Usuarios). |
| `atencion.puestos` | catálogo | Puestos por sucursal ("Puesto 1", "Puesto 2"), orden y estado. |
| `atencion.sesiones` | hechos, **particionada mensual** | Cada "Iniciar/Cerrar atención": usuario, sucursal, recepción o puesto, inicio, fin, motivo de cierre (manual / medianoche / liberado). Un usuario y un puesto solo pueden tener una sesión abierta. |
| `atencion.contadores` | catálogo | Último número por sucursal y fecha local (reinicio diario sin carreras). |
| `atencion.turnos` | hechos, **particionada mensual** | Número del día, sucursal, nombre, teléfono, factura, estado (esperando / llamado / atendido / ausente / anulado), puesto, horas de llamado y fin. |
| `atencion.turno_eventos` | hechos, **particionada mensual** | Historial: llamado, repetido, fuera de orden, ausente, finalizado, anulado. |
| `atencion.pantallas` | catálogo | Pantallas públicas por sucursal (identificadas como dispositivo, sin login, como el kiosco de RRHH). |

Reglas técnicas:
- **Fecha local:** la base trabaja en UTC; día, reinicio y cierre usan `America/Managua` (UTC−6, sin horario de verano).
- **Puesto automático:** la RPC toma el primer puesto activo sin sesión abierta con `FOR UPDATE SKIP LOCKED`; dos agentes al mismo tiempo nunca reciben el mismo puesto.
- **Cierre a medianoche:** `pg_cron` (disponible, hoy no instalado) ejecuta a las 06:00 UTC (= 00:00 Nicaragua) el cierre de sesiones abiertas. Respaldo: cualquier RPC trata como cerrada una sesión de un día anterior. `pg_cron` también resolvería las particiones mensuales (hoy manuales).
- **Lógica en RPC** (`public.atencion_*`, security definer + `core.has_permission`), reutilizable por la web y una futura app de tablets/móvil.
- **Pantalla pública:** número siempre; puesto, nombre del cliente y del agente según la configuración de cada pantalla (2026-10-15); teléfono y factura nunca salen hacia ella.

## 5. Pendiente

- ~~Aprobación del Paso Cero (sección 3)~~ — aplicado 2026-10-14.
- ~~Reparto usuario ↔ sucursal~~ — aprobado: se asignan desde Configuración → Usuarios; con una sola sucursal asignada, "Iniciar atención" la usa sin preguntar; con varias, el usuario elige.
- ~~Migración de tablas (sección 4) e instalación de `pg_cron`~~ — aplicadas 2026-10-14.
- Pantallas (Sucursales en Configuración, `apps/atencion`, pantalla pública) y activación de la app.
