# Atención (`apps/atencion`)

Turnos de sala de espera por sucursal: recepción entrega números, los agentes
los llaman desde su puesto y una pantalla pública los muestra con
entretenimiento. Diseño y decisiones: [`docs/plan/13-atencion-turnos.md`](../../docs/plan/13-atencion-turnos.md).

- Zona `/atencion` de Multi-Zones (`basePath`), login único en `apps/nexo`.
- Toda la lógica vive en las RPC `public.atencion_*` de `nexo-core`
  (asignación automática de puesto, numeración diaria, cierre a medianoche).
- `/atencion/pantalla/<id>`: pantalla pública sin login (el `id` de la
  pantalla es la credencial del dispositivo, como el kiosco de RRHH).

Desarrollo local (puerto 3004):

```bash
pnpm --filter nexo-atencion dev:zone
```

Variables: ver `.env.local.example`. En Vercel: proyecto propio con Root
Directory `apps/atencion`; en `nexocore`, `ATENCION_APP_URL` apunta a su deploy.
