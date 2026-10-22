import { test } from 'node:test';
import assert from 'node:assert/strict';
// Reportes de Asistencia (2026-10-18): formateadores y filtros puros.
// Se ejecuta con: node --experimental-strip-types --test supabase/tests/rrhh_reportes_formato.test.mjs
import {
  minutosHM, horaManagua, horaProgramada, fechaCorta, fechaDMA, fechaHoraManagua, porcentaje, minutosPromedio,
  nombreArchivo, rangoPorDefecto, validarRango, leerFiltros, filtrosAQuery, filtrosParaAuditoria,
  resolverContrato, describirFiltros, errorDeRpc, estadoDia, textoObservaciones, esReporte, RANGO_INVALIDO,
  FILTROS_INVALIDOS,
} from '../../apps/rrhh/src/lib/reportes-asistencia/formato.ts';
import { registerHooks } from 'node:module';

// documento.ts/tabla.ts/pdf.ts importan con rutas relativas SIN extensión
// (como pide Next/TS con moduleResolution "bundler"). Node no las resuelve
// solo; este hook, local a este archivo de prueba, prueba "<ruta>.ts" para
// esos imports. No toca tsconfig ni package.json.
const hooksDisponibles = typeof registerHooks === 'function';
if (hooksDisponibles) {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL?.endsWith('.ts')) {
        try { return nextResolve(`${specifier}.ts`, context); } catch { /* sigue con el original */ }
      }
      return nextResolve(specifier, context);
    },
  });
}

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

test('minutos a H:MM', () => {
  assert.equal(minutosHM(510), '8:30');
  assert.equal(minutosHM(0), '0:00');
  assert.equal(minutosHM(5), '0:05');
  assert.equal(minutosHM(12345), '205:45');
  assert.equal(minutosHM(-15), '-0:15');
  assert.equal(minutosHM(null), '—');
  assert.equal(minutosHM(undefined), '—');
});

test('horas en America/Managua, 24 h', () => {
  // 14:05 UTC = 08:05 en Managua (UTC-6 todo el año).
  assert.equal(horaManagua('2026-10-17T14:05:00+00:00'), '08:05');
  assert.equal(horaManagua('2026-10-18T03:30:00Z'), '21:30');
  // Medianoche local no sale como 24:00.
  assert.equal(horaManagua('2026-10-17T06:00:00Z'), '00:00');
  assert.equal(horaManagua(null), '—');
  assert.equal(horaManagua('no-es-fecha'), '—');
  assert.equal(horaProgramada('08:00:00'), '08:00');
  assert.equal(horaProgramada(null), '—');
  assert.equal(fechaHoraManagua('2026-10-18T02:15:00Z'), '17/10/2026 20:15');
});

test('fechas dd/mm/aaaa con día de semana', () => {
  assert.equal(fechaDMA('2026-10-17'), '17/10/2026');
  assert.equal(fechaCorta('2026-10-17'), 'sáb 17/10/2026');
  assert.match(fechaCorta('2026-10-16'), /^vie\.? 16\/10\/2026$/);
  assert.match(fechaCorta('2026-10-19'), /^lun\.? 19\/10\/2026$/);
  assert.equal(fechaCorta('2026-02-30'), '2026-02-30');
});

test('puntualidad, promedio y nombre de archivo', () => {
  assert.equal(porcentaje(0.8333), '83,3 %');
  assert.equal(porcentaje(1), '100,0 %');
  assert.equal(porcentaje(0), '0,0 %');
  assert.equal(porcentaje(null), '—');
  assert.equal(minutosPromedio(12.5), '12,5 min');
  assert.equal(nombreArchivo('diaria', '2026-10-01', '2026-10-17'), 'asistencia-diaria-2026-10-01-2026-10-17.pdf');
  assert.equal(nombreArchivo('tarjeta', '2026-09-01', '2026-09-30'), 'asistencia-tarjeta-2026-09-01-2026-09-30.pdf');
});

test('etiquetas: estado desconocido no se disfraza', () => {
  assert.deepEqual(estadoDia('completo'), { label: 'Completo', tone: 'positive' });
  assert.equal(estadoDia('pendiente_hoy').label, 'Pendiente (hoy)');
  assert.deepEqual(estadoDia('otro'), { label: 'otro', tone: 'warning' });
  assert.equal(textoObservaciones(['tardanza', 'sin_descanso_marcado']), 'Tardanza; Descanso no marcado: se descontó el programado');
  assert.equal(textoObservaciones([]), '—');
  assert.equal(esReporte('resumen'), true);
  assert.equal(esReporte('otro'), false);
});

test('rango: máximo 62 días, desde ≤ hasta, hasta ≤ hoy', () => {
  const hoy = '2026-10-17';
  assert.deepEqual(rangoPorDefecto(hoy), { desde: '2026-10-01', hasta: '2026-10-17' });
  assert.equal(validarRango('2026-08-17', '2026-10-17', hoy), null); // 62 días incluidos
  assert.equal(validarRango('2026-08-16', '2026-10-17', hoy), RANGO_INVALIDO); // 63
  assert.equal(validarRango('2026-10-17', '2026-10-18', hoy), RANGO_INVALIDO); // futuro
  assert.match(validarRango('2026-10-10', '2026-10-01', hoy), /posterior/);
  assert.match(validarRango('2026-02-30', '2026-03-01', hoy), /inválida/);
  assert.match(validarRango('', '2026-10-01', hoy), /inválida/);
});

test('leerFiltros: valores por defecto, validación y filtros que no aplican', () => {
  const hoy = '2026-10-17';
  const vacio = leerFiltros('diaria', {}, hoy);
  assert.equal(vacio.error, null);
  assert.equal(vacio.filtros.desde, '2026-10-01');
  assert.equal(vacio.filtros.hasta, hoy);
  assert.equal(vacio.filtros.pagina, 1);

  const completo = leerFiltros('diaria', new URLSearchParams(
    `desde=2026-10-01&hasta=2026-10-10&departamento=${U1}&estado=completo&no_laborables=1&pagina=3&tipo=tardanza&contrato=${U2}`), hoy);
  assert.equal(completo.error, null);
  assert.equal(completo.filtros.estado, 'completo');
  assert.equal(completo.filtros.incluirNoLaborables, true);
  assert.equal(completo.filtros.pagina, 3);
  assert.equal(completo.filtros.tipo, ''); // tipo no aplica a la diaria
  assert.equal(completo.filtros.contratoId, ''); // contrato solo en la tarjeta

  assert.equal(leerFiltros('resumen', { pagina: '4' }, hoy).filtros.pagina, 1); // sin paginación
  assert.equal(leerFiltros('diaria', { pagina: '-2' }, hoy).filtros.pagina, 1);
  assert.equal(leerFiltros('diaria', { pagina: '0' }, hoy).filtros.pagina, 1);

  assert.equal(leerFiltros('diaria', { desde: '2026-01-01', hasta: '2026-10-17' }, hoy).error, RANGO_INVALIDO);
  assert.ok(leerFiltros('diaria', { departamento: 'x' }, hoy).error);
  assert.ok(leerFiltros('diaria', { estado: 'ausente' }, hoy).error);
  assert.ok(leerFiltros('tardanzas', { tipo: 'sin_marcas' }, hoy).error);
  assert.equal(leerFiltros('incidencias', { tipo: 'sin_marcas' }, hoy).error, null);
  assert.equal(leerFiltros('tardanzas', { tipo: 'salida_temprana' }, hoy).error, null);
  assert.equal(leerFiltros('tarjeta', { empleado: U1, contrato: U2 }, hoy).filtros.contratoId, U2);
});

test('filtrosAQuery y auditoría: solo lo que aplica', () => {
  const hoy = '2026-10-17';
  const { filtros } = leerFiltros('diaria', { desde: '2026-10-01', hasta: '2026-10-10', empleado: U1, estado: 'sin_marcas', no_laborables: '1' }, hoy);
  assert.equal(filtrosAQuery('diaria', filtros), `desde=2026-10-01&hasta=2026-10-10&empleado=${U1}&estado=sin_marcas&no_laborables=1`);
  assert.equal(filtrosAQuery('diaria', filtros, 2).endsWith('&pagina=2'), true);
  assert.equal(filtrosAQuery('resumen', filtros, 2), `desde=2026-10-01&hasta=2026-10-10&empleado=${U1}`);
  assert.deepEqual(filtrosParaAuditoria('diaria', filtros), {
    desde: '2026-10-01', hasta: '2026-10-10', empleado_id: U1, estado: 'sin_marcas', incluir_no_laborables: true,
  });
  assert.deepEqual(filtrosParaAuditoria('tardanzas', filtros), { desde: '2026-10-01', hasta: '2026-10-10', empleado_id: U1 });
  // Ida y vuelta por la URL.
  const vuelta = leerFiltros('diaria', new URLSearchParams(filtrosAQuery('diaria', filtros, 2)), hoy);
  assert.deepEqual(vuelta.filtros, { ...filtros, pagina: 2 });
});

test('tarjeta: persona obligatoria y contrato si tiene varios', () => {
  const empleados = [
    { id: U1, label: 'Pérez, Ana (7)', contratos: [{ id: U2, numero: 3, estado: 'activo' }] },
    { id: U3, label: 'Ruiz, Luis (9)', contratos: [{ id: U1, numero: 1, estado: 'finalizado' }, { id: U2, numero: 2, estado: 'activo' }] },
  ];
  assert.deepEqual(resolverContrato(empleados, '', ''), { estado: 'falta_empleado' });
  assert.deepEqual(resolverContrato(empleados, U1, ''), { estado: 'ok', contratoId: U2 });
  assert.deepEqual(resolverContrato(empleados, U3, ''), { estado: 'falta_contrato' });
  assert.deepEqual(resolverContrato(empleados, U3, U1), { estado: 'ok', contratoId: U1 });
  assert.deepEqual(resolverContrato(empleados, U1, U1), { estado: 'invalido' }); // contrato ajeno
  assert.deepEqual(resolverContrato(empleados, U2, ''), { estado: 'invalido' });

  const opciones = { departamentos: [{ id: U1, nombre: 'Ventas' }], puestos: [], empleados };
  const { filtros } = leerFiltros('tarjeta', { departamento: U1, empleado: U3, contrato: U1 }, '2026-10-17');
  assert.deepEqual(describirFiltros('tarjeta', filtros, opciones), ['Departamento: Ventas', 'Persona: Ruiz, Luis (9)', 'Contrato: N.º 1']);
});

test('claves heredadas (toString, constructor) no son estados ni tipos válidos', () => {
  const hoy = '2026-10-17';
  for (const estado of ['toString', 'constructor', '__proto__', 'hasOwnProperty'])
    assert.ok(leerFiltros('diaria', { estado }, hoy).error, estado);
  for (const tipo of ['toString', 'constructor'])
    for (const r of ['tardanzas', 'incidencias']) assert.ok(leerFiltros(r, { tipo }, hoy).error, `${r} ${tipo}`);
  assert.deepEqual(estadoDia('toString'), { label: 'toString', tone: 'warning' });
  assert.equal(textoObservaciones(['constructor']), 'constructor');
});

test('diaria: estados de días no laborables fuerzan incluirlos', () => {
  const hoy = '2026-10-17';
  for (const estado of ['feriado', 'dia_descanso', 'sin_jornada']) {
    const { filtros, error } = leerFiltros('diaria', { estado }, hoy);
    assert.equal(error, null);
    assert.equal(filtros.incluirNoLaborables, true, estado);
    assert.match(filtrosAQuery('diaria', filtros), /no_laborables=1/);
  }
  assert.equal(leerFiltros('diaria', { estado: 'completo' }, hoy).filtros.incluirNoLaborables, false);
  assert.equal(leerFiltros('diaria', { estado: 'completo', no_laborables: '1' }, hoy).filtros.incluirNoLaborables, true);
  // En otros reportes no aplica.
  assert.equal(leerFiltros('resumen', { estado: 'feriado' }, hoy).filtros.incluirNoLaborables, false);
});

test('errores de RPC: nunca el texto crudo de Postgres', () => {
  assert.equal(errorDeRpc({ code: '42501', message: 'Sin permiso' }).motivo, 'denegado');
  assert.deepEqual(errorDeRpc({ code: '22023', message: 'Filtros invalidos' }), { motivo: 'filtros', mensaje: FILTROS_INVALIDOS });
  assert.match(FILTROS_INVALIDOS, /62 días/);
  assert.match(FILTROS_INVALIDOS, /estado y tipo/);
  const acota = errorDeRpc({ code: '22023', message: 'Demasiados contratos (2500): acota con departamento o puesto' });
  assert.equal(acota.motivo, 'filtros');
  assert.doesNotMatch(acota.mensaje, /2500|Demasiados contratos/);
  const otro = errorDeRpc({ code: 'XX000', message: 'relation "rrhh.x" does not exist' });
  assert.equal(otro.motivo, 'error');
  assert.doesNotMatch(otro.mensaje, /relation|rrhh/);
});

test('PDF de humo: 300 filas de la diaria generan un PDF de varias páginas', { skip: hooksDisponibles ? false : 'Node sin module.registerHooks (requiere 22.15+/23.5+)' }, async () => {
  const { armarDocumento } = await import('../../apps/rrhh/src/lib/reportes-asistencia/documento.ts');
  const { generarPdf } = await import('../../apps/rrhh/src/lib/reportes-asistencia/pdf.ts');
  const fila = (i) => ({
    fecha: `2026-10-${String(1 + (i % 17)).padStart(2, '0')}`, es_hoy: false, contrato_id: `c${i}`, contrato_numero: 1,
    empleado_id: `e${i % 40}`, empleado_codigo: 100 + (i % 40), empleado_nombre: `Núñez, Ana ${i % 40}`,
    departamento_id: null, departamento: 'Ventas', puesto_id: null, puesto: 'Cajera', jornada_id: 'j', jornada_nombre: 'Diurna',
    laborable: true, es_feriado: false, feriado_nombre: null, hora_entrada_prog: '08:00:00', hora_salida_prog: '17:00:00',
    descanso_prog_min: 60, tol_entrada_min: 10, tol_salida_min: 5, entrada: '2026-10-01T14:12:00Z', inicio_descanso: null,
    fin_descanso: null, salida: '2026-10-01T23:00:00Z', marcas_count: 2, secuencia: ['entrada', 'salida'], descanso_real_min: null,
    descanso_aplicado_min: 60, descanso_origen: 'programado', minutos_netos: 468, minutos_programados: 480,
    minutos_sobre_jornada: 0, minutos_no_laborable: null, minutos_tardanza: 12, minutos_salida_temprana: null,
    estado: 'completo', observaciones: ['tardanza', 'sin_descanso_marcado'],
  });
  const filas = Array.from({ length: 300 }, (_, i) => fila(i));
  const { filtros } = leerFiltros('diaria', {}, '2026-10-17');
  const documento = armarDocumento({
    datos: { reporte: 'diaria', total: filas.length, totales: { completos: 300 }, filas },
    filtros, opciones: null,
    emision: { emitido_en: '2026-10-18T02:15:00Z', emitido_por: 'Prueba', empresa: 'Empresa de prueba con un nombre bastante largo S.A.', empresa_ruc: 'J0000000000000' },
  });
  const pdf = Buffer.from(generarPdf(documento));
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  const paginas = (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;
  assert.ok(paginas > 1, `páginas: ${paginas}`);
});