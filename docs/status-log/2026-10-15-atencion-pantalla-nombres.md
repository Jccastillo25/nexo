# 2026-10-15 — Pantalla de Atención: nombre del cliente y del agente

## Contexto

Pedido del usuario: al llamar un turno, la pantalla debe decir
"Turno 5, Juan Pérez, será atendido por (nombre del usuario que llamó)".

Esto **revierte una regla aprobada** del [plan 13](../plan/13-atencion-turnos.md)
("la pantalla pública muestra solo números y puestos, nunca nombres"). Se le
explicó al usuario el costo antes de implementar:
`public.atencion_pantalla_estado` es una RPC **anónima** (la credencial es el
id de la pantalla), así que quien tenga la URL del televisor puede leer los
nombres de los clientes llamados en ese momento, además de oírlos en la sala.
Decisiones del usuario (2026-10-15):

- Cliente: **nombre completo**, tal como lo registra recepción (se ofreció
  "nombre + inicial del apellido" como alternativa y no la eligió).
- Anuncio: **agente y puesto**: "Turno 5, Juan Pérez, será atendido por
  María López en Puesto 2".

## Estado anterior → estado nuevo

- Pantalla y voz: "Turno 5, Puesto 2" → "Turno 5, Juan Pérez, será atendido
  por María López en Puesto 2". **Aplicado en remoto, sin probar en un
  televisor real.**

## Entregado

- Migración `20261015151609_atencion_pantalla_nombres` (aplicada en
  `nexo-core`; el archivo local `20261015120000_…` se renombró a la versión
  remota sin tocar el SQL). Reemplaza `public.atencion_pantalla_estado`: cada
  elemento de `llamados` agrega `cliente` (`atencion.turnos.cliente_nombre`) y
  `agente` (`core.perfiles.nombre_completo` de `turnos.atendido_por`, que
  `atencion_llamar` llena con quien llamó). `left join`: sin perfil,
  `agente = null`. Los `proximos` siguen siendo solo números; teléfono y
  factura nunca salen. Grants iguales (`anon`, `authenticated`).
- `apps/atencion`:
  - `pantalla-publica.tsx`: la voz usa `frase()`; sin agente dice
    "Turno 5, Juan Pérez, pase a Puesto 2". La tarjeta principal muestra
    número, nombre del cliente, "Será atendido por …" y puesto. Las filas
    secundarias muestran número, cliente y puesto.
  - `database.types.ts`: `PantallaEstado.llamados` con `cliente` y `agente`.
  - Textos que decían "nunca nombres" (comentario de `pantalla/[id]/page.tsx`,
    descripción en Configuración → Pantallas) actualizados.

## Pruebas ejecutadas

- `next build` de `apps/atencion` limpio (incluye typecheck); `eslint` limpio.
- Remoto antes de aplicar: la definición de la función coincidía con
  `20261014224341`.
- Remoto después: versión `20261015151609` registrada; `anon` conserva
  `EXECUTE`; con una pantalla real devuelve el JSON esperado.
- Turno ficticio insertado en un bloque que termina en excepción (se revierte
  todo): la RPC devolvió `cliente: "Juan Pérez (prueba)"`,
  `agente: "Julio Castillo"`, `puesto: "Puesto 1"`.
- Compatibilidad: el frontend en producción (anterior a este cambio) ignora
  los campos nuevos, así que aplicar la migración antes del deploy no rompe
  nada.

## Pendiente / deuda

- Probar en el televisor la voz (`es-ES`, nombres largos) y el corte visual de
  nombres largos.
- Riesgo aceptado por el usuario: nombres de clientes expuestos por la RPC
  anónima a quien tenga la URL de la pantalla. Mitigación posible si se
  necesita: rotar el id de la pantalla (crear una nueva y desactivar la vieja).
