import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { KioskFlow } from '../../apps/rrhh/src/app/kiosco/kiosk-flow.ts';

const ephemeralPin=()=>String(randomInt(10000)).padStart(4,'0');
test('cancelar una salida no envia ninguna otra llamada',async()=>{
 let calls=0;
 const flow=new KioskFlow(async()=>{calls++;return {estado:'confirmacion_requerida',message:''};});
 await flow.submit(ephemeralPin());
 assert.equal(flow.hasPending,true);
 assert.equal(flow.cancel(),true);
 assert.equal(calls,1);
 assert.equal(flow.hasPending,false);
});
test('red, vista previa y confirmacion conservan UUID; nuevo envio usa otro',async()=>{
 const ids=[]; const flags=[]; let i=0;
 const flow=new KioskFlow(async(_pin,id,confirmar)=>{
  ids.push(id);flags.push(confirmar);i++;
  if(i===1||i===3) throw new Error('simulacion de red');
  if(i===2)return {estado:'confirmacion_requerida',message:''};
  return {estado:'registrada',tipo:'salida',message:''};
 });
 assert.equal((await flow.submit(ephemeralPin())).estado,'error');
 assert.equal((await flow.retry()).estado,'confirmacion_requerida');
 assert.equal((await flow.confirm()).estado,'error');
 assert.equal((await flow.retry()).estado,'registrada');
 assert.equal(new Set(ids).size,1);
 assert.deepEqual(flags,[false,false,true,true]);
 assert.equal(flow.hasPending,false);
 await flow.submit(ephemeralPin());
 assert.notEqual(ids[0],ids[4]);
});
test('doble pulsacion concurrente comparte una sola llamada',async()=>{
 let calls=0;let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const flow=new KioskFlow(async()=>{calls++;await gate;return {estado:'registrada',tipo:'entrada',message:''};});
 const first=flow.submit(ephemeralPin()); const second=flow.submit(ephemeralPin());
 assert.equal(first,second);assert.equal(flow.cancel(),false);
 release();await Promise.all([first,second]);
 assert.equal(calls,1);assert.equal(flow.hasPending,false);
});
