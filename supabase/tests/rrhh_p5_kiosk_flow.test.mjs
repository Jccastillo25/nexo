import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { KioskFlow } from '../../apps/rrhh/src/app/kiosco/kiosk-flow.ts';

// P4c (2026-10-17): vista previa con accion=null y el boton elegido con el
// mismo UUID. Ningun caso toca la base: el sender es un doble en memoria.
const ephemeralPin=()=>String(randomInt(10000)).padStart(4,'0');
const ofrece=(...acciones)=>({estado:'acciones',acciones,message:''});

test('cancelar con los botones a la vista hace una sola llamada',async()=>{
 let calls=0;
 const flow=new KioskFlow(async()=>{calls++;return ofrece('inicio_descanso','salida');});
 await flow.submit(ephemeralPin());
 assert.equal(flow.hasPending,true);
 assert.equal(flow.cancel(),true);
 assert.equal(calls,1);
 assert.equal(flow.hasPending,false);
});
test('red, vista previa, eleccion y reintentos comparten UUID; nuevo envio usa otro',async()=>{
 const ids=[]; const acciones=[]; let i=0;
 const flow=new KioskFlow(async(_pin,id,accion)=>{
  ids.push(id);acciones.push(accion);i++;
  if(i===1||i===3) throw new Error('simulacion de red');
  if(i===2)return ofrece('inicio_descanso','salida');
  return {estado:'registrada',tipo:'salida',marcadoEn:'2026-10-17T23:02:00Z',message:''};
 });
 assert.equal((await flow.submit(ephemeralPin())).estado,'error');
 assert.equal((await flow.retry()).estado,'acciones');
 assert.equal((await flow.choose('salida')).estado,'error');
 assert.equal((await flow.retry()).estado,'registrada');
 assert.equal(new Set(ids).size,1);
 assert.deepEqual(acciones,[null,null,'salida','salida']);
 assert.equal(flow.hasPending,false);
 await flow.submit(ephemeralPin());
 assert.notEqual(ids[0],ids[4]);
 assert.equal(acciones[4],null);
});
test('choose con una accion no ofrecida no llama al sender',async()=>{
 let calls=0;
 const flow=new KioskFlow(async()=>{calls++;return ofrece('fin_descanso');});
 await flow.submit(ephemeralPin());
 const r=await flow.choose('salida');
 assert.equal(r.estado,'rechazada');
 assert.equal(calls,1);
 assert.equal(flow.hasPending,true);
});
test('choose sin vista previa no llama al sender',async()=>{
 let calls=0;
 const flow=new KioskFlow(async()=>{calls++;return ofrece('entrada');});
 await flow.choose('entrada');
 assert.equal(calls,0);
});
test('doble pulsacion del mismo boton produce una sola llamada',async()=>{
 let commits=0;let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const flow=new KioskFlow(async(_pin,_id,accion)=>{
  if(accion===null)return ofrece('entrada');
  commits++;await gate;return {estado:'registrada',tipo:'entrada',message:''};
 });
 await flow.submit(ephemeralPin());
 const first=flow.choose('entrada'); const second=flow.choose('entrada');
 assert.equal(first,second);assert.equal(flow.cancel(),false);
 release();await Promise.all([first,second]);
 assert.equal(commits,1);assert.equal(flow.hasPending,false);
});
test('doble pulsacion concurrente del PIN comparte una sola llamada',async()=>{
 let calls=0;let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const flow=new KioskFlow(async()=>{calls++;await gate;return ofrece('entrada');});
 const first=flow.submit(ephemeralPin()); const second=flow.submit(ephemeralPin());
 assert.equal(first,second);assert.equal(flow.cancel(),false);
 release();await Promise.all([first,second]);
 assert.equal(calls,1);assert.equal(flow.hasPending,true);
});
test('despues de cancel no queda nada pendiente y choose no envia',async()=>{
 let calls=0;
 const flow=new KioskFlow(async()=>{calls++;return ofrece('inicio_descanso','salida');});
 await flow.submit(ephemeralPin());
 assert.equal(flow.cancel(),true);
 assert.equal(flow.hasPending,false);
 const r=await flow.choose('inicio_descanso');
 assert.equal(r.estado,'rechazada');
 assert.equal(calls,1);
 assert.equal(flow.hasPending,false);
});
test('accion_no_disponible limpia el flujo y el siguiente envio usa otro UUID',async()=>{
 const ids=[];
 const flow=new KioskFlow(async(_pin,id,accion)=>{
  ids.push(id);
  if(accion===null)return ofrece('inicio_descanso','salida');
  return {estado:'rechazada',motivo:'accion_no_disponible',message:''};
 });
 await flow.submit(ephemeralPin());
 assert.equal((await flow.choose('salida')).motivo,'accion_no_disponible');
 assert.equal(flow.hasPending,false);
 assert.equal((await flow.retry()).estado,'rechazada');
 assert.equal(ids.length,2);
 await flow.submit(ephemeralPin());
 assert.notEqual(ids[2],ids[0]);
});
test('sin_acciones y revision tambien limpian el flujo',async()=>{
 for(const motivo of ['sin_acciones','revision']){
  const flow=new KioskFlow(async()=>({estado:'rechazada',motivo,message:''}));
  await flow.submit(ephemeralPin());
  assert.equal(flow.hasPending,false);
 }
});
