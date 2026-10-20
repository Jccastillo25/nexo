# 2026-10-20 — Kiosco: rutas que mandaban al login sin sesión

## Reporte del usuario

"En producción el kiosko si intento ingresar de un dispositivo sin sesión iniciada me manda a iniciar sesión." Mandó una foto de un iPad con Safari en `nexo.materialesjcastillo.com`, que mostraba el login.

## Diagnóstico (producción, sin sesión)

| Dirección | Antes |
|---|---|
| `/rrhh/kiosco` y `/rrhh/kiosco?asignar=1` | 200, "Terminal sin asignar". Correcto, también con el User-Agent de iPad Safari |
| `/kiosco`, `/asistencia/kiosco` | 307 al login (son rutas del panel) |
| `/rrhh/asistencia/kiosco` | 307 al login |
| `/rrhh/Kiosco` (con mayúscula) | 307 al login: `apps/rrhh/src/proxy.ts` comparaba con `startsWith("/kiosco")`, que distingue mayúsculas |

La terminal funciona, pero cualquier dirección que no sea exactamente `/rrhh/kiosco` caía en el login. Safari solo muestra el dominio, así que la foto no permite saber cuál se abrió.

## Cambio

- `apps/nexo/next.config.ts`: `redirects` de `/kiosco` y `/asistencia/kiosco` a `/rrhh/kiosco`.
- `apps/rrhh/next.config.ts`: `redirects` de `/asistencia/kiosco` a `/kiosco`; el basePath da `/rrhh/kiosco`.
- `apps/rrhh/src/proxy.ts`: cualquier variante de mayúsculas de `/kiosco` redirige a `/kiosco` antes del guard. Solo se exime la ruta exacta y sus subrutas; antes `startsWith("/kiosco")` también dejaba sin guard rutas como `/kioscoX`.

Las redirecciones de `next.config` corren antes del proxy (orden documentado en `next/dist/docs/.../proxy.md`), por eso no piden sesión. Se conserva la query (`?asignar=1`).

## Pruebas (local: panel en 3000 y RRHH en 3002, sin sesión)

| Dirección | Resultado |
|---|---|
| `/rrhh/kiosco` | 200 |
| `/rrhh/Kiosco`, `/rrhh/KIOSCO?asignar=1` | 307 a `/rrhh/kiosco` (con la query), y luego 200 |
| `/kiosco`, `/kiosco?asignar=1`, `/asistencia/kiosco` | 307 a `/rrhh/kiosco`, y luego 200 |
| `/rrhh/asistencia/kiosco` | 307 a `/rrhh/kiosco`, y luego 200 |
| `/rrhh/kioscos`, `/rrhh/asistencia` | 307 al login. Correcto: ya no se eximen |

- En el navegador, `localhost:3000/kiosco?asignar=1` mostró "Terminal sin asignar".
- `typecheck` y `lint` de `rrhh` y `nexo-panel` pasaron en verde. También se corrieron typecheck, lint y build en la rama del PR.

## Pendiente

- Publicar: PR desde `main` con solo este arreglo, y que lo fusione el usuario.
- Si alguien escribe solo el dominio, sigue viendo el login, porque esa es la entrada del panel. Se propuso un botón "Abrir kiosco de marcación" en el login, todavía sin decidir.
- Detectado de paso, menor y sin tocar: el script de Speed Insights de la zona RRHH (`/<hash>/script.js` en la raíz) lo intercepta el proxy del panel y recibe el HTML del login. Eso deja un `SyntaxError` en la consola del kiosco, pero no afecta la marcación.
