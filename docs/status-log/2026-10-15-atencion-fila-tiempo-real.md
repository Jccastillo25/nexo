# 2026-10-15 — Atención: fila del puesto en tiempo real + aviso sonoro

## Contexto

Pedido del usuario: "el panel del puesto no actualiza de manera automática si
tiene más en fila de espera; esto tiene que ser en tiempo real. Tiene que
enviar una notificación sonora cada vez que llegue un nuevo despacho".

## Diagnóstico

El panel ya refrescaba con `setInterval` cada 4 s (`use-cola.ts`). Causa más
probable, **no confirmada** (no hay acceso al navegador del puesto y los logs
de Vercel no registran cada petición): Chrome congela los temporizadores de
las pestañas en segundo plano (a una vez por minuto o menos), y el agente
trabaja en otra ventana. Un WebSocket de Realtime sí entrega mensajes en
segundo plano.

Primer diseño descartado tras probarlo: broadcast desde la base con
`realtime.send`. En `nexo-core`, `realtime.messages` no tiene particiones y
`realtime.send` convierte el error en WARNING: el aviso se perdía en silencio
(verificado en un bloque revertido: mensaje `NULL`).

## Estado anterior → estado nuevo

- Fila del puesto y de recepción: refresco cada 4 s → **Realtime** (al
  instante) + recarga al volver a la pestaña + respaldo cada 15 s.
- Aviso de cliente nuevo: no existía → **sonido + aviso en pantalla** en el
  puesto, y la cantidad en espera en el título de la pestaña.

## Entregado

- Migración `20261015162540_atencion_cola_tiempo_real` (aplicada en
  `nexo-core`; archivo creado como `20261015190000_…`, renombrado a la versión
  remota sin tocar el SQL):
  - `public.atencion_cola_senales` (una fila por sucursal: `version`,
    `cambiado_en`; sin datos del cliente; tabla de estado, no particionada),
    en la publicación `supabase_realtime`. RLS: solo `select` para
    `authenticated`, filtrado por `public.atencion_puede_escuchar(sucursal_id)`
    (security definer: sucursal asignada u owner + `atencion.cola.turno.ver`).
    Sin escritura desde la API.
  - Trigger `trg_atencion_turnos_avisar` (after insert/update en
    `atencion.turnos`, clonado en las 4 particiones) → sube la versión.
  - Sin permisos nuevos.
- `apps/atencion`:
  - `src/lib/supabase/client.ts`: cliente de navegador (solo para Realtime).
  - `use-cola.ts`: escucha la señal de la sucursal y recarga por la Server
    Action de siempre (`atencion_cola`); recarga al volver a la pestaña,
    al recuperar conexión y al (re)suscribirse; respaldo cada 15 s.
    `onNuevos` informa los turnos que entraron a la espera.
  - `aviso-sonoro.ts`: botón "Activar sonido de nuevos clientes", recordado
    en el navegador; suena una vez al activarlo. Tras recargar, el primer toque
    en la página lo habilita (regla de los navegadores).
  - Puesto: indicador "● En vivo" / "Reconectando…", aviso en pantalla y
    "(N) Puesto · Atención" en el título de la pestaña.

## Pruebas ejecutadas

- `next build` + `eslint` de `apps/atencion` limpios.
- Bloque revertido: alta de un turno → versión 1; cambio de estado → 2; como
  `authenticated`, el agente con puesto abierto ve 1 fila y un usuario ajeno
  0; `atencion_puede_escuchar` rechaza usuario ajeno y sin sesión.
- Remoto después: versión registrada, tabla en la publicación, `anon` sin
  `select`, `authenticated` sin `insert`, trigger en la tabla y particiones.
- **No probado de punta a punta con un navegador real** (sin credenciales de
  usuario en esta sesión): falta ver el "● En vivo" y el sonido en el puesto.

## Pendiente

- ~~Merge y deploy~~: PR #25 fusionado (`main` `9e015cc`), los 5 deploys de
  producción READY.
- Prueba en el puesto: abrir Atender, activar el sonido, dejar la pestaña en
  segundo plano y crear un turno desde recepción.
