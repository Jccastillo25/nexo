import { test } from 'node:test';
import assert from 'node:assert/strict';
// 2026-10-17: Marcas se movió a la app Asistencia y hoyManagua a lib/.
import { filtrosValidos } from '../../apps/rrhh/src/app/(asistencia)/asistencia/marcas/filtros.ts';
import { hoyManagua } from '../../apps/rrhh/src/lib/fecha-managua.ts';
test('fechas reales, rango inclusivo y limites de paginacion',()=>{
 assert.equal(filtrosValidos({desde:'2026-01-01',hasta:'2026-03-03'}),true);
 for(const f of [{desde:'2026-02-30',hasta:'2026-03-01'}, {desde:'2026-01-01',hasta:'2026-03-04'},
  {desde:'2026-01-02',hasta:'2026-01-01'}, {desde:'2026-01-01',hasta:'2026-01-01',offset:-1},
  {desde:'2026-01-01',hasta:'2026-01-01',offset:0.5}, {desde:'2026-01-01',hasta:'2026-01-01',estado:'ausente'}]) assert.equal(filtrosValidos(f),false);
 assert.match(hoyManagua(),/^\d{4}-\d{2}-\d{2}$/);
});
test('estados de descanso (P4c) aceptados y desconocidos rechazados',()=>{
 for(const estado of ['registrada','entrada_abierta_hoy','falta_salida','en_descanso_hoy','descanso_sin_cerrar','sin_descanso_marcado',''])
  assert.equal(filtrosValidos({desde:'2026-01-01',hasta:'2026-01-01',estado}),true,estado);
 assert.equal(filtrosValidos({desde:'2026-01-01',hasta:'2026-01-01',estado:'descanso'}),false);
});
