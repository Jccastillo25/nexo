// SOLO OPERADOR. No se encadena a test:db/verify ni se ejecuta en CI.
// Tras aprobacion y SQL A, dos contratos PRUEBA borrador, empleados distintos,
// jornada y mismo tenant/kiosco PRUEBA. Requiere JWT de usuario de pruebas con
// activar y marcas.ver; otros JWT reales sin permiso y de empresa ajena.
// PINes solo en memoria; manifiesto contiene UUIDs, nunca respuestas completas.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

if (process.env.CI || process.env.NEXO_PRUEBA_AUTORIZADA !== 'SI') {
 console.error('No autorizado: este arnes es exclusivo del Operador despues de aplicar y aprobar las migraciones.');
 process.exit(1);
}
let stage='preflight';
let pins=[];
try {
 const input=JSON.parse(process.env.NEXO_PRUEBA_FIXTURES ?? '{}');
 const required=['companyId','kioskoId','contratoSecuenciaId','contratoIdempotenciaId'];
 const config=Object.fromEntries(required.map(key=>[key,input[key]]));
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(required.some(key=>!uuid.test(config[key]??'')) || config.contratoSecuenciaId===config.contratoIdempotenciaId)throw new Error();
 const url=process.env.NEXO_PRUEBA_SUPABASE_URL;
 const key=process.env.NEXO_PRUEBA_ANON_KEY;
 const token=process.env.NEXO_PRUEBA_JWT;
 const deniedToken=process.env.NEXO_PRUEBA_JWT_SIN_PERMISO;
 const otherToken=process.env.NEXO_PRUEBA_JWT_OTRA_EMPRESA;
 if(!url||!key||!token||!deniedToken||!otherToken)throw new Error();
 const target=new URL(url);
 if(target.protocol!=='https:'||!target.hostname.endsWith('.supabase.co'))throw new Error();
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const manifest=path.resolve(process.env.NEXO_PRUEBA_MANIFIESTO ?? path.join(os.tmpdir(),'nexo-rrhh-p7-manifiesto.json'));
 if(manifest.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw new Error();
 const saved={...config,envios:[],estado:'preparado',fecha:new Date().toISOString()};
 const save=()=>fs.writeFile(manifest,JSON.stringify(saved,null,2)+'\n',{mode:0o600});
 await save();
 async function rpc(name,args,jwt=token){
  const response=await fetch(new URL('/rest/v1/rpc/'+name,target),{
   method:'POST',headers:{apikey:key,...(jwt?{Authorization:'Bearer '+jwt}:{}),'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(60000),
  });
  if(!response.ok){
   const problem=await response.json().catch(()=>null);
   return {ok:false,denied:problem?.code==='P0001'&&problem?.message==='Sin permiso'};
  }
  return {ok:true,data:await response.json()};
 }
 // Precondicion: sin marcas en ambos contratos. El Operador verifica ademas
 // nombres PRUEBA, borrador, jornada y misma empresa en SQL antes de ejecutar.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Managua'}).format(new Date());
 const query={p_company_id:config.companyId,p_desde:today,p_hasta:today};
 for(const id of [config.contratoSecuenciaId,config.contratoIdempotenciaId]){
  const r=await rpc('consultar_marcas',{...query,p_contrato_id:id});
  if(!r.ok||!Array.isArray(r.data)||r.data.length)throw new Error();
 }
 stage='activaciones concurrentes';
 const results=await Promise.all([config.contratoSecuenciaId,config.contratoIdempotenciaId].map(id=>rpc('activar_contrato',{p_company_id:config.companyId,p_contrato_id:id})));
 pins=results.map(result=>result.ok&&Array.isArray(result.data)?result.data[0]?.pin_kiosko:null);
 for(const result of results) if(Array.isArray(result.data)) for(const row of result.data) delete row.pin_kiosko;
 if(pins.some(pin=>typeof pin!=='string'||!/^\d{4}$/.test(pin))||pins[0]===pins[1])throw new Error();
 saved.estado='activados';await save();
 console.log('OK activaciones simultaneas: credenciales distintas (comparadas solo en memoria)');
 async function mark(pin,solicitud,confirmar){return rpc('registrar_marca_kiosko',{p_pin:pin,p_kiosko_id:config.kioskoId,p_solicitud_id:solicitud,p_confirmar_salida:confirmar},null);}
 const seq=[randomUUID(),randomUUID()];const idem=randomUUID();
 saved.envios=[...seq,idem];saved.solicitudIdempotente=idem;await save();
 stage='secuencia concurrente';
 const pair=await Promise.all(seq.map(id=>mark(pins[0],id,true)));
 if(pair.some(r=>!r.ok||r.data?.estado!=='registrada') || new Set(pair.map(r=>r.data.tipo)).size!==2)throw new Error();
 stage='idempotencia concurrente';
 const same=await Promise.all([mark(pins[1],idem,false),mark(pins[1],idem,false)]);
 if(same.some(r=>!r.ok||r.data?.estado!=='registrada'||r.data.tipo!=='entrada'))throw new Error();
 const replay=await mark(pins[1],idem,true);
 if(!replay.ok||JSON.stringify(replay.data)!==JSON.stringify(same[0].data))throw new Error();
 stage='lectura e independencia de empresa';
 const sequenceRows=await rpc('consultar_marcas',{...query,p_contrato_id:config.contratoSecuenciaId});
 const idemRows=await rpc('consultar_marcas',{...query,p_contrato_id:config.contratoIdempotenciaId});
 if(!sequenceRows.ok||sequenceRows.data.length!==2||!idemRows.ok||idemRows.data.length!==1)throw new Error();
 saved.marcas=[...sequenceRows.data,...idemRows.data].map(r=>r.marca_id);await save();
 const denied=await rpc('consultar_marcas',query,deniedToken);
 const foreign=await rpc('consultar_marcas',query,otherToken);
 if(!denied.denied||!foreign.denied)throw new Error();
 saved.estado='pruebas aprobadas; verificar SQL B y recorrido manual';await save();
 console.log('OK secuencia, idempotencia, autorizacion y empresa ajena; manifiesto privado guardado sin PIN');
} catch {
 console.error('FALLO P7 en etapa: '+stage+'. No reejecutar sobre contratos ya activados sin revisar el manifiesto; PIN/errores de red omitidos.');
 process.exitCode=1;
} finally { pins.fill(null); pins=[]; }
