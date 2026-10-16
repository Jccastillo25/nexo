import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrosValidos, hoyManagua } from '../../apps/rrhh/src/app/(app)/marcas/filtros.ts';
test('fechas reales, rango inclusivo y limites de paginacion',()=>{
 assert.equal(filtrosValidos({desde:'2026-01-01',hasta:'2026-03-03'}),true);
 for(const f of [{desde:'2026-02-30',hasta:'2026-03-01'}, {desde:'2026-01-01',hasta:'2026-03-04'},
  {desde:'2026-01-02',hasta:'2026-01-01'}, {desde:'2026-01-01',hasta:'2026-01-01',offset:-1},
  {desde:'2026-01-01',hasta:'2026-01-01',offset:0.5}, {desde:'2026-01-01',hasta:'2026-01-01',estado:'ausente'}]) assert.equal(filtrosValidos(f),false);
 assert.match(hoyManagua(),/^\d{4}-\d{2}-\d{2}$/);
});
