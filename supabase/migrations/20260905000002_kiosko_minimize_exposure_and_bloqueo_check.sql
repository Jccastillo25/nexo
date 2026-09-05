-- =============================================================================
-- Nexo — endurecimiento del kiosko anonimo (pedido explicito del usuario,
-- 2026-09-05, regla obligatoria #4): "el kiosco funcional sin sesion
-- unicamente si su funcion queda limitada a registrar entrada/salida...
-- No debe... revelar datos personales", y la verificacion obligatoria
-- exige que "PIN invalido, kiosko inactivo y empleado bloqueado son
-- rechazados".
--
-- Evidencia consultada antes de escribir esta migracion:
--   - Lectura directa de rrhh.fn_registrar_marca_kiosko
--     (20260902000006_rrhh_schema_and_tables.sql): el SELECT que busca al
--     empleado por PIN NO filtraba por pin_bloqueado (columna agregada
--     despues, en 20260902000008, para el candado de acceso operativo) —
--     un empleado bloqueado por 3 fallos en fn_validar_acceso_operativo
--     podia marcar en el kiosko fisico igual, porque ambas funciones
--     comparten el mismo pin_hash pero nunca se habian conectado por esta
--     columna. CONFIRMADO por lectura de codigo, no es una hipotesis.
--   - La funcion devuelve `empleado_nombre` (nombre y apellido completos)
--     en texto plano a una llamada sin autenticar (anon) — dato personal
--     expuesto sin sesion. CONFIRMADO por lectura de codigo
--     (apps/rrhh/src/app/kiosco/actions.ts y kiosk-client.tsx lo
--     muestran en pantalla tal cual).
--
-- Clasificacion:
--   - CONFIRMADO como riesgo/gap funcional: ambos puntos de arriba.
--   - DECISION DELIBERADA, fuera de esta migracion: el kiosko NO
--     incrementa intentos_fallidos ni fija pin_bloqueado el mismo cuando
--     el PIN es incorrecto (eso queda exclusivo de
--     fn_validar_acceso_operativo, el flujo de login operativo). Fijarlo
--     tambien desde el kiosko abriria una superficie de abuso cruzada
--     nueva: alguien parado frente al kiosko fisico podria bloquear a
--     proposito el acceso operativo (movil) de un companero probando PINs
--     ajenos, sin que exista ese vinculo hoy. Esta migracion solo hace que
--     el kiosko RESPETE un bloqueo ya existente, no que lo cause — si se
--     quiere que el kiosko tambien bloquee, es una decision de negocio
--     nueva que el usuario debe confirmar aparte.
--
-- Cambia el tipo de retorno (se quita `empleado_nombre`) -> requiere DROP
-- + CREATE, no alcanza con CREATE OR REPLACE (Postgres no permite
-- cambiar el RETURNS TABLE de una funcion existente sin dropearla). Los
-- GRANT se pierden en el DROP y se re-otorgan explicitamente al final.
-- =============================================================================

drop function if exists public.registrar_marca_kiosko(text, uuid);
drop function if exists rrhh.fn_registrar_marca_kiosko(text, uuid);

create function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_empleado rrhh.empleados%rowtype;
  v_ultimo_tipo text;
  v_tipo text;
  v_marcado_en timestamptz := now();
begin
  select * into v_kiosko from rrhh.kiosko_dispositivos where id = p_kiosko_id;
  if not found or not v_kiosko.activo then
    raise exception 'Kiosco invalido o inactivo';
  end if;

  select * into v_empleado
  from rrhh.empleados
  where company_id = v_kiosko.company_id
    and estado = 'activo'
    and pin_hash is not null
    and not pin_bloqueado
    and crypt(p_pin, pin_hash) = pin_hash
  limit 1;

  if not found then
    -- Mismo mensaje generico sin importar la causa real (PIN incorrecto,
    -- empleado inexistente, o bloqueado): anti-enumeracion, mismo
    -- criterio que fn_validar_acceso_operativo.
    raise exception 'PIN invalido';
  end if;

  select am.tipo into v_ultimo_tipo
  from rrhh.asistencia_marcas am
  where am.empleado_id = v_empleado.id
  order by am.marcado_en desc
  limit 1;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'salida' else 'entrada' end;

  insert into rrhh.asistencia_marcas (company_id, empleado_id, kiosko_id, tipo, marcado_en, origen)
  values (v_kiosko.company_id, v_empleado.id, p_kiosko_id, v_tipo, v_marcado_en, 'kiosko');

  -- A proposito: NO se devuelve nombre/apellido ni ningun otro dato
  -- personal del empleado. El kiosko es un dispositivo sin sesion — el
  -- unico feedback que necesita es que tipo de marca quedo y a que hora,
  -- nunca la identidad de quien marco (regla obligatoria #4 de la
  -- auditoria de seguridad, 2026-09-05).
  return query select v_tipo, v_marcado_en;
end;
$$;

comment on function rrhh.fn_registrar_marca_kiosko is
  'Registra entrada/salida desde un kiosko fisico. Auth por PIN+kiosko_id, no por auth.uid(). Rechaza PIN invalido, kiosko inactivo y empleado con pin_bloqueado (2026-09-05). No devuelve datos personales del empleado a proposito -- ver nota de seguridad en el cuerpo de la funcion.';

create function public.registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_registrar_marca_kiosko(p_pin, p_kiosko_id);
$$;

comment on function public.registrar_marca_kiosko is
  'Wrapper publico de rrhh.fn_registrar_marca_kiosko. Callable por anon a proposito (el kiosko no tiene sesion) -- limitado a registrar la marca, sin devolver datos personales (2026-09-05).';

grant execute on function public.registrar_marca_kiosko(text, uuid) to anon, authenticated;
