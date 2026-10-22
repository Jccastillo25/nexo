# Plan — CRM: embudo comercial (Leads, Oportunidades, Actividades, Cotizaciones)

> **RETIRADO el 2026-10-20.** El usuario pidió borrar el CRM y replicar AG Negocio, su ERP actual ([plan 18](18-replica-ag-negocio.md)). Las pantallas, los esquemas `crm`/`metas` y sus permisos se borraron sin datos (`20261020143821`). El código está en la rama local `respaldo/crm-2026-10-20`. Este documento queda solo como historia.

> **Estado: Paso Cero APROBADO y APLICADO (2026-10-19, `20261019152215`).**
> El catálogo tiene 34 permisos `crm` y las plantillas quedaron en 17, 27 y 34.
> Sin tablas ni pantallas: siguen la especificación (§6) y el esquema.
> [Detalle](../status-log/2026-10-19-crm-embudo-paso-cero.md).
>
> Parte de la FASE 3 ([plan/06](06-fase3-crm.md)): `Lead → Oportunidad →
> Cotización → Pedido`. El pedido queda fuera de este corte.
> Referencia funcional: [NextCRM](https://github.com/pdovhomilja/nextcrm-app)
> (MIT). Se toma su modelo de datos como guía; no se copia código.

## 1. Verificación remota (2026-10-19, `nexo-core`)

- `core.apps`: `crm` activa.
- `core.permissions_catalog` (módulo `crm`): 13 códigos.
  - `crm.ver_modulo` y `crm.clientes.{ver,crear,editar,eliminar}`.
  - Metas y ventas (2026-10-18): `crm.metas.*`, `crm.ventas.factura*` y `crm.configuracion.vendedor.gestionar`.
  - Ningún código de lead, oportunidad, actividad, cotización ni embudo.
- `core.app_roles` (módulo `crm`):
  - `vendedor`: 4 permisos.
  - `gerente`: 10 permisos.
  - `administrador`: 13 permisos.
- Schema `crm`: solo la tabla `clientes`.

## 2. Qué se toma de NextCRM y qué cambia

| NextCRM | Nexo |
|---|---|
| `crm_Leads` + catálogos de origen, estado y tipo | `crm.leads` + orígenes configurables. Estados fijos: nuevo, contactado, calificado, descartado, convertido |
| No hay vínculo de conversión lead → oportunidad | Convertir un lead crea o vincula el cliente y abre la oportunidad, y guarda de dónde vino cada uno |
| `crm_Opportunities` + `Sales_Stages` (probabilidad, orden) | `crm.oportunidades` + `crm.etapas` configurables (probabilidad, orden, tipo: abierta, ganada o perdida) + motivo de pérdida |
| `crm_Activities` (call, meeting, note, email, visit; scheduled, completed, cancelled) | `crm.actividades` con los mismos tipos y estados, ligada a un lead, una oportunidad o un cliente. **Particionada por mes** porque es una tabla de hechos |
| Sin modelo de cotización (solo `OpportunityLineItems`) | `crm.cotizaciones` + líneas con productos del catálogo `productos`, descuento, aprobación y PDF. Particionada por mes |
| `assigned_to` + rol global user/manager/admin | `responsable_id` = usuario de Nexo. "Propio" = asignado a mí. Ver a todo el equipo lo da un permiso, no un rol fijo |

Como en Metas, toda la lógica va en RPC `security definer` (Web y Mobile), no en Server Actions.

## 3. Matriz de permisos (21 códigos nuevos)

Regla de alcance: sin `crm.ventas.equipo.ver`, cada quien ve y edita solo los
registros donde es responsable. Con ese permiso, los de todos. La RPC filtra.

| Código | Qué permite |
|---|---|
| `crm.ventas.lead.ver` | Ver leads |
| `crm.ventas.lead.crear` | Registrar leads |
| `crm.ventas.lead.editar` | Editar, cambiar estado y descartar |
| `crm.ventas.lead.convertir` | Convertir a cliente + oportunidad. Crea el cliente aunque no se tenga `crm.clientes.crear` |
| `crm.ventas.lead.eliminar` | Borrado lógico |
| `crm.ventas.oportunidad.ver` | Ver oportunidades y el embudo (kanban) |
| `crm.ventas.oportunidad.crear` | Crear oportunidades |
| `crm.ventas.oportunidad.editar` | Editar, mover de etapa, ganar o perder |
| `crm.ventas.oportunidad.eliminar` | Borrado lógico |
| `crm.ventas.actividad.ver` | Ver llamadas, visitas, reuniones, notas y correos, y la agenda |
| `crm.ventas.actividad.crear` | Registrar o agendar |
| `crm.ventas.actividad.editar` | Editar, completar o cancelar |
| `crm.ventas.actividad.eliminar` | Borrado lógico |
| `crm.ventas.cotizacion.ver` | Ver y descargar el PDF |
| `crm.ventas.cotizacion.crear` | Crear borradores |
| `crm.ventas.cotizacion.editar` | Editar el borrador y enviarla |
| `crm.ventas.cotizacion.aprobar` | Aprobar las que superan el descuento permitido |
| `crm.ventas.cotizacion.anular` | Anular una cotización enviada |
| `crm.ventas.equipo.ver` | Ver y operar los registros de todo el equipo |
| `crm.ventas.asignacion.gestionar` | Cambiar el responsable de leads, oportunidades y cotizaciones |
| `crm.configuracion.embudo.gestionar` | Etapas, probabilidades, orígenes, motivos de pérdida y descuento máximo sin aprobación |

## 4. Plantillas (se amplían las 3 existentes)

| Plantilla | Recibe |
|---|---|
| Vendedor (4 → 17) | `ver`, `crear` y `editar` de lead, oportunidad, actividad y cotización, más `lead.convertir`. Solo lo propio |
| Gerente de ventas (10 → 27) | Todo lo nuevo excepto los tres `*.eliminar` (lead, oportunidad, actividad) y `embudo.gestionar`. Sí puede aprobar y anular cotizaciones |
| Administrador de ventas (13 → 34) | Los 21 |

Las plantillas no asignan a nadie. Los roles de empresa se arman en Configuración → Roles.

## 5. SQL (aplicado tal cual en [`20261019152215_crm_embudo_paso_cero.sql`](../../supabase/migrations/20261019152215_crm_embudo_paso_cero.sql), con descripciones completas)

```sql
do $$
begin
  if exists (select 1 from core.permissions_catalog
             where code like 'crm.ventas.lead.%' or code like 'crm.ventas.oportunidad.%'
                or code like 'crm.ventas.actividad.%' or code like 'crm.ventas.cotizacion.%'
                or code in ('crm.ventas.equipo.ver','crm.ventas.asignacion.gestionar',
                            'crm.configuracion.embudo.gestionar')) then
    raise exception 'precheck: los permisos del embudo ya existen';
  end if;
  if (select count(*) from core.app_roles where module_slug = 'crm'
        and role_key in ('vendedor','gerente','administrador')) <> 3 then
    raise exception 'precheck: faltan las plantillas del CRM';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('crm.ventas.lead.ver',              'crm','ventas','Ver leads',               'Ver prospectos (propios, o de todos con equipo.ver).'),
  ('crm.ventas.lead.crear',            'crm','ventas','Crear leads',             'Registrar prospectos.'),
  ('crm.ventas.lead.editar',           'crm','ventas','Editar leads',            'Editar, cambiar estado y descartar prospectos.'),
  ('crm.ventas.lead.convertir',        'crm','ventas','Convertir leads',         'Convertir un prospecto en cliente y oportunidad.'),
  ('crm.ventas.lead.eliminar',         'crm','ventas','Eliminar leads',          'Borrado lógico de prospectos.'),
  ('crm.ventas.oportunidad.ver',       'crm','ventas','Ver oportunidades',       'Ver oportunidades y el embudo.'),
  ('crm.ventas.oportunidad.crear',     'crm','ventas','Crear oportunidades',     'Crear oportunidades de venta.'),
  ('crm.ventas.oportunidad.editar',    'crm','ventas','Editar oportunidades',    'Editar, mover de etapa, ganar o perder.'),
  ('crm.ventas.oportunidad.eliminar',  'crm','ventas','Eliminar oportunidades',  'Borrado lógico de oportunidades.'),
  ('crm.ventas.actividad.ver',         'crm','ventas','Ver actividades',         'Ver llamadas, visitas, reuniones, notas, correos y agenda.'),
  ('crm.ventas.actividad.crear',       'crm','ventas','Registrar actividades',   'Registrar o agendar actividades.'),
  ('crm.ventas.actividad.editar',      'crm','ventas','Editar actividades',      'Editar, completar o cancelar actividades.'),
  ('crm.ventas.actividad.eliminar',    'crm','ventas','Eliminar actividades',    'Borrado lógico de actividades.'),
  ('crm.ventas.cotizacion.ver',        'crm','ventas','Ver cotizaciones',        'Ver cotizaciones y descargar el PDF.'),
  ('crm.ventas.cotizacion.crear',      'crm','ventas','Crear cotizaciones',      'Crear cotizaciones en borrador.'),
  ('crm.ventas.cotizacion.editar',     'crm','ventas','Editar cotizaciones',     'Editar el borrador y enviarlo al cliente.'),
  ('crm.ventas.cotizacion.aprobar',    'crm','ventas','Aprobar cotizaciones',    'Aprobar cotizaciones con descuento mayor al permitido.'),
  ('crm.ventas.cotizacion.anular',     'crm','ventas','Anular cotizaciones',     'Anular una cotización enviada.'),
  ('crm.ventas.equipo.ver',            'crm','ventas','Ver al equipo',           'Ver y operar leads, oportunidades, actividades y cotizaciones de todos.'),
  ('crm.ventas.asignacion.gestionar',  'crm','ventas','Reasignar responsable',   'Cambiar el responsable de leads, oportunidades y cotizaciones.'),
  ('crm.configuracion.embudo.gestionar','crm','configuracion','Configurar embudo','Etapas, probabilidades, orígenes, motivos de pérdida y descuento máximo.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p
  on p.module_slug = 'crm'
 and (p.code like 'crm.ventas.lead.%' or p.code like 'crm.ventas.oportunidad.%'
      or p.code like 'crm.ventas.actividad.%' or p.code like 'crm.ventas.cotizacion.%'
      or p.code in ('crm.ventas.equipo.ver','crm.ventas.asignacion.gestionar',
                    'crm.configuracion.embudo.gestionar'))
where r.module_slug = 'crm'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'gerente' and p.code not like '%.eliminar'
        and p.code <> 'crm.configuracion.embudo.gestionar')
    or (r.role_key = 'vendedor' and (
          p.code ~ '^crm\.ventas\.(lead|oportunidad|actividad|cotizacion)\.(ver|crear|editar)$'
          or p.code = 'crm.ventas.lead.convertir'))
  );

do $$
declare n_cat int; n_v int; n_g int; n_a int;
begin
  select count(*) into n_cat from core.permissions_catalog where module_slug = 'crm';
  select count(*) filter (where r.role_key='vendedor'),
         count(*) filter (where r.role_key='gerente'),
         count(*) filter (where r.role_key='administrador')
    into n_v, n_g, n_a
  from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
  where r.module_slug = 'crm';
  if n_cat <> 34 or n_v <> 17 or n_g <> 27 or n_a <> 34 then
    raise exception 'postcheck: catálogo %, vendedor %, gerente %, administrador %', n_cat, n_v, n_g, n_a;
  end if;
end;
$$;
```

Ensayo en `nexo-core` dentro de una transacción revertida (2026-10-19): precheck en verde. El resultado da catálogo 34, vendedor 17, gerente 27 y administrador 34. No quedó nada escrito.

## 6. Después de aprobar (orden)

1. Aplicar la migración y verificar los conteos en remoto.
2. ✅ Especificación de `ux-planner` lista (2026-10-19): [16a-crm-embudo-especificacion-ux.md](16a-crm-embudo-especificacion-ux.md). Faltan las respuestas del usuario a P1–P7 y S6. Cubre:
   - Leads: lista y ficha.
   - Embudo: kanban.
   - Oportunidad: ficha.
   - Agenda de actividades.
   - Cotización: editor y PDF.
3. ✅ Esquema aplicado el 2026-10-20 (`20261020060058`, 48 RPC, 19 pruebas revertidas en verde; [detalle](../status-log/2026-10-20-crm-embudo-esquema.md)). Incluye:
   - `crm.etapas`, `crm.origenes`, `crm.motivos_perdida`, `crm.leads` y `crm.oportunidades`.
   - `crm.actividades` y `crm.cotizaciones` + líneas, particionadas por mes.
   - RPC `public.crm_*` con `core.has_permission` y el filtro de alcance.
   - `GRANT` en la misma migración.
4. Implementar las pantallas en `apps/crm`, en el grupo Ventas, que hoy muestra "Pronto". Después pasan revisión independiente, pruebas y documentación.
