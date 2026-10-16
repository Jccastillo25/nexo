# RRHH — paquete único para el Operador

Fecha: 2026-10-16. Rama: `codex/rrhh-piloto-mvp`, base `e5a3eec`.

P2–P6 están implementados en esta rama y probados localmente con PGlite y la
puerta `pnpm verify`. **Ninguna de estas migraciones se aplicó en esta sesión.**
P1 también estaba pendiente según la última verificación disponible. No se
consultó Supabase ni Vercel. No hay piloto autorizado ni E2E remoto aprobado.
M1–M4, nómina, horas, descansos marcados y turnos nocturnos siguen fuera.

## 1. Antes de aplicar

El usuario debe aprobar este paquete y el destino `nexo-core`. El Operador
verifica migraciones ya registradas, definiciones actuales, permisos, conteos,
índices/particiones y ausencia de otros escritores de credenciales. Si hay
marcas, **P3 aborta**: no eliminar historia ni inferir contratos para forzarlo.
Si hay credenciales vigentes, revisar colisiones antes de habilitar nuevas
activaciones; no comparar hashes bcrypt entre sí ni imprimir candidatos.
Si el remoto difiere del esquema de partida, detener la aplicación y revisar.

Mantener los kioscos sin marcaciones durante la aplicación. P4b elimina la RPC
antigua: no restaurarla al revertir la app. Tras aplicar, publicar el cliente
compatible solo con aprobación de merge/despliegue. No cambiar Vercel ahora.

Los archivos SQL nuevos se aplican en una transacción por migración. No
modificar el SQL histórico de P1. Registrar la versión real de cada aplicación
y ajustar el nombre del archivo si fuese necesario, sin alterar su contenido.
No volver a aplicar una migración ya registrada para obtener otro timestamp.

## 2. Orden exacto, verificación posterior y rollback

### 1 — P1 (si todavía falta)

Archivo: `supabase/migrations/20261015181000_p1_pin_ambiguo_fallo_cerrado.sql`.

```sql
select position('ambiguo' in pg_get_functiondef(
 'rrhh.fn_registrar_marca_kiosko(text,uuid)'::regprocedure)) > 0 as tiene_p1;
```

Esperado: `true` **en este momento del orden**, antes de P4b. Rollback:
conservar fallo cerrado; no restaurar selección arbitraria de una credencial.

### 2 — P2

Archivo: `supabase/migrations/20261016231000_rrhh_p2_pin_unico_empresa.sql`.

```sql
select p.proname,
 position('random()' in pg_get_functiondef(p.oid)) = 0 as sin_random,
 position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0 as lock_empresa,
 position('gen_random_bytes' in pg_get_functiondef(p.oid)) > 0 as generador_seguro
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rrhh' and p.proname in ('fn_activar_contrato','fn_regenerar_pin_contrato');
```

Esperado: dos filas, tres booleanos verdaderos. También comprobar permiso
denegado y carrera de activación en P7. Rollback: conservar hashes y corregir
hacia adelante; no restaurar `random()`. Regenerar no reutiliza el PIN propio
anterior y se serializa antes de leer el estado contractual. Cada candidato
compara bcrypt con el conjunto vigente; con muchos empleados puede ser lento.

### 3 — P3

Archivo: `supabase/migrations/20261016232000_rrhh_p3_marca_contrato.sql`.

```sql
select is_nullable='NO' as contrato_obligatorio from information_schema.columns
where table_schema='rrhh' and table_name='asistencia_marcas' and column_name='contrato_id';
select convalidated as fk_validada from pg_constraint
where conrelid='rrhh.asistencia_marcas'::regclass and conname='asistencia_marcas_contrato_fk';
select not has_table_privilege('authenticated','rrhh.asistencia_marcas','INSERT,UPDATE,DELETE') as sin_escritura_directa;
select count(*)=0 as sin_policies_escritura from pg_policies
where schemaname='rrhh' and tablename='asistencia_marcas' and cmd<>'SELECT';
```

Esperado: todos verdaderos; revisar además índices y grants de las particiones
con P7 A. Rollback: conservar el vínculo contractual y el historial; corregir
hacia adelante. No reabrir la escritura directa. `SELECT` y `marcas.ver` siguen
disponibles; no se registraron permisos nuevos ni se reasignaron roles.

### 4 — P4a

Archivo: `supabase/migrations/20261016233000_rrhh_p4a_kiosko_solicitudes.sql`.

```sql
select exists(select 1 from core.tablas_particionadas
 where schema_nombre='rrhh' and tabla_nombre='kiosko_solicitudes') as registrada;
select count(*)=4 as cuatro_meses from generate_series(0,3) g(i)
where to_regclass('rrhh.kiosko_solicitudes_' ||
 to_char(date_trunc('month',now())+make_interval(months=>g.i),'YYYY_MM')) is not null;
select not has_table_privilege('anon','rrhh.kiosko_solicitudes','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('authenticated','rrhh.kiosko_solicitudes','SELECT,INSERT,UPDATE,DELETE') as privada;
```

Esperado: verdaderos. El job existente recorre `core.tablas_particionadas`, no
se modifica `pg_cron`. Retención igual que marcas: sin borrado automático.
Rollback: si está vacía y aún no se aplicó P4b podría retirarse tabla/registro
con revisión; con resultados guardados conservarlos para mantener idempotencia.

### 5 — P4b

Archivo: `supabase/migrations/20261016234000_rrhh_p4b_marca_atomica_idempotente.sql`.

```sql
select to_regprocedure('public.registrar_marca_kiosko(text,uuid)') is null as firma_antigua_cerrada,
 to_regprocedure('public.registrar_marca_kiosko(text,uuid,uuid,boolean)') is not null as nueva_disponible;
select has_function_privilege('anon','public.registrar_marca_kiosko(text,uuid,uuid,boolean)','EXECUTE') as wrapper_permitido,
 not has_function_privilege('anon','rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,boolean)','EXECUTE') as interna_denegada;
```

Esperado: verdaderos. Validar además respuestas y carreras con el cliente nuevo
y P7. La migración notifica recarga del esquema a PostgREST. Rollback: no
restaurar la firma de dos argumentos ni borrar solicitudes; corregir hacia
adelante o mantener kiosco deshabilitado. Marcas y resultado idempotente se
confirman en la misma transacción; la vista previa no guarda resultado.

### 6 — P6

Archivo: `supabase/migrations/20261016235000_rrhh_p6_consultar_marcas.sql`.

```sql
select has_function_privilege('authenticated','public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer)','EXECUTE') as autenticado,
 not has_function_privilege('anon','public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer)','EXECUTE') as no_anonimo,
 not has_function_privilege('authenticated','rrhh.fn_consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer)','EXECUTE') as interna_restringida;
```

Esperado: verdaderos. Ejecutar lectura autorizada/sin permiso/empresa ajena;
no basta con ver los grants. Solo se devuelven datos mínimos de empleado y
contrato (incluido su número), no credenciales. Rollback: retirar la página y
wrappers de lectura si fuera necesario, sin modificar las marcas existentes.

## 3. P7.1 — pruebas remotas pendientes

1. Ejecutar **sección A** de `supabase/tests/rrhh_p7_remoto.sql`: grants,
   RLS efectiva sin identidad, denegación de escritura directa y particiones.
   Se revierte con `ROLLBACK`. Revisar planes de acceso e índices si los conteos
   remotos difieren de los fixtures. No aplicar los archivos de entorno PGlite.
2. Preparar privadamente DOS empleados/contratos `PRUEBA` distintos, ambos
   borrador y con jornada, en la misma empresa. No reutilizar contratos con
   marcas para las carreras. Verificar nombres y UUID exactos en el manifiesto.
3. Preparar sesiones REALES: usuario autorizado con activar y marcas.ver,
   otro sin marcas.ver y otro de empresa ajena. No dar permisos extra a
   usuarios reales para hacer pasar la prueba. Los JWT y claves se suministran
   en memoria mediante entorno del proceso, nunca se pegan en este documento.
4. El Operador, después de aprobarlo, ejecuta:

   ```powershell
   node supabase/tests/rrhh_p7_concurrencia.mjs
   ```

   El proceso exige `NEXO_PRUEBA_AUTORIZADA=SI`, URL/clave en
   `NEXO_PRUEBA_SUPABASE_URL`/`NEXO_PRUEBA_ANON_KEY`, tres JWT en
   `NEXO_PRUEBA_JWT`, `NEXO_PRUEBA_JWT_SIN_PERMISO`,
   `NEXO_PRUEBA_JWT_OTRA_EMPRESA` y JSON `NEXO_PRUEBA_FIXTURES` con estas claves
   (solo UUID, **no PIN**): `companyId`, `kioskoId`, `contratoSecuenciaId`,
   `contratoIdempotenciaId`. Nunca imprimir el entorno ni guardar esos JWT en
   scripts/historial. Por defecto el manifiesto de UUID queda en el directorio
   temporal del Operador, `nexo-rrhh-p7-manifiesto.json`; se rechaza guardarlo
   dentro del repo. Si falla una etapa, revisar ese manifiesto antes de repetir:
   puede haber contratos activados y marcas ya confirmadas.

   Prueba activaciones simultáneas, dos envíos distintos del mismo contrato y
   el mismo token en paralelo, consulta posterior, denegación y empresa ajena.
   Compara PIN solo en memoria; no imprime respuestas completas ni errores de
   red que puedan incluir argumentos. Rechaza ejecución si detecta `CI`.
5. Ejecutar **sección B** del SQL por separado, configurando sus cinco GUC con
   los UUID del manifiesto dentro de la misma transacción. Esperado: un par
   en el contrato de secuencia, una entrada y un resultado definitivo en el
   contrato/token de idempotencia. No confundir ejecución secuencial con carrera.
6. Verificar renovación de particiones en ventana controlada con el mecanismo
   existente y `get_advisors(security)` contra la línea base. El archivo SQL no
   puede ejecutar esa herramienta MCP. Registrar hallazgos y evidencias sin PIN.

El CI solo ejecuta P7 A sobre el modelo desechable. **Eso no valida el remoto,
el modelo real de roles ni concurrencia entre conexiones PostgreSQL.**

## 4. P7.2 — guion del recorrido manual

Con migraciones aplicadas y cliente nuevo, siempre desde
`http://localhost:3000/rrhh` y usando solo datos `PRUEBA`:

Iniciar los servidores desde la copia que tenga esta rama, no desde otra copia
de main. Si los puertos están ocupados, identificar los servidores anteriores
antes de reemplazarlos. El `.env.local` de RRHH ya está configurado en la copia
de trabajo; las variables del panel también deben ser locales y no versionadas.

```powershell
pnpm --filter nexo-panel dev
# En otra terminal, desde la misma copia de la rama:
pnpm --filter rrhh run dev:zone
```

1. Con un rol real autorizado, crear expediente con datos obligatorios. Verificar
   que no pide ni emite PIN. Comprobar el rechazo de campos faltantes.
2. Crear contrato borrador con departamento, puesto y plantilla válidos de la
   misma empresa. Todavía no hay credencial.
3. Asignar jornada compatible. Usar Ventas solo si coincide con el horario
   real; si no, crear una jornada de prueba. Probar que sin jornada no activa.
4. Activar con permiso específico; mostrar PIN una vez y entregarlo en privado.
   No fotografiarlo, grabarlo ni guardarlo en archivo/log. Recargar: no reaparece.
5. En kiosco PRUEBA: digitar PIN; entrada registrada, sin identidad.
6. Digitarlo otra vez: «¿Registrar salida?»; cancelar. No cambia el conteo de
   marcas ni se guarda una solicitud definitiva por la vista previa.
7. Nuevo envío y confirmar: salida inmediata, sin espera fija. Si se pierde la
   respuesta, usar Reintentar: conserva el UUID y no duplica la salida.
8. Tercer envío lógico del día: rechazo genérico, sin nueva marca.
9. En Marcas: consultar hoy, filtrar empleado/contrato/estado, detalle y páginas.
   Deben verse entrada y salida reales; vacío dice «Sin marcas registradas».
10. Para **ayer abierto**, usar OTRO contrato PRUEBA sin marcas hoy o un día
    posterior: el Operador prepara una entrada de ayer con aprobación. Marcas
    muestra «Falta salida», y el primer envío de hoy crea entrada nueva. No usar
    el contrato que ya completó el par hoy: eso seguiría rechazando una tercera.
11. Probar PIN incorrecto y ocho fallos nuevos en el kiosco PRUEBA: bloqueo de
    cinco minutos. Mismo token reintentado no suma otro fallo. Probar kiosco
    inactivo y credencial revocada sin afectar al dispositivo real.
12. Repetir Marcas con usuario sin permiso y empresa ajena: sin datos ajenos,
    página «Sin permiso» o RPC denegada. El enlace puede seguir visible: el menú
    conserva su patrón existente; no es la autoridad del permiso.
13. Finalizar contrato PRUEBA; PIN anterior no marca. Recontratar, asignar
    jornada y activar: marcas anteriores conservan contrato viejo; nuevas,
    contrato nuevo.
14. Probar el reporte por canal corporativo aprobado. Registrar privadamente
    responsables/buzón/custodia, evidencia y decisión de autorizar o posponer.

Un fallo crítico **pospone el piloto**. Corregir y repetir el caso y recorrido.
Estas entregas no implementan corrección manual auditada (M1–M4) ni nómina.

## 5. Limpieza y publicación

El Operador reúne UUID exactos de fixtures, marcas, tokens y dispositivos en
manifiesto privado. Presenta candidatos y dependencias antes de borrar;
la aprobación de limpieza del alcance no sustituye esa revisión final de IDs.
No usar solamente `LIKE 'PRUEBA%'`, no borrar catálogos/kiosco real ni auditoría,
no usar `CASCADE` manual para forzar la limpieza. Si existe una retención o
trigger que impide borrar, conservar historial y reportarlo.

El PR queda **en borrador**. No mergear ni cambiar Vercel. Aplicar migraciones,
ejecutar P7 y publicar son pasos separados sujetos a aprobación del usuario.
Consultar el enlace y estado exacto del CI en la entrega final de esta sesión;
`lint-deuda` sigue siendo informativo, no prueba una regresión de RRHH.
