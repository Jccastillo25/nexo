import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./rrhh_p7_concurrencia.mjs',import.meta.url));
for(const scenario of [
 {name:'CI deniega aunque alguien active la bandera de Operador',env:{CI:'true',NEXO_PRUEBA_AUTORIZADA:'SI'}},
 {name:'sin aprobacion explicita no se inicia el arnes remoto',env:{CI:'',NEXO_PRUEBA_AUTORIZADA:''}},
])test(scenario.name,()=>{
 const run=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,...scenario.env}});
 assert.equal(run.status,1);
 assert.match(run.stderr,/^No autorizado:/);
 assert.equal(run.stdout,'');
});
