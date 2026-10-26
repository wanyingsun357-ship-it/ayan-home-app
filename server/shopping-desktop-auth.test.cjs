'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),net=require('net'),express=require('express'),assert=require('node:assert/strict');
const {WebSocket}=require('ws'),{register,attach}=require('./shopping-browser-desktop.cjs');
function rotateSource(source,label='ayan-engine-internal-20261026-r2') {
 const pattern=/(\bconst\s+internal\s*=\s*crypto\.createHmac\([^;\n]+?\.update\()(['"])[^'"\n]+\2(\)\.digest\([^;\n]+?;)/g;
 if([...source.matchAll(pattern)].length!==1)throw Error('Internal derivation anchor changed');
 return source.replace(pattern,(_,prefix,quote,suffix)=>prefix+JSON.stringify(label)+suffix);
}
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ayan-auth-isolated-')),originalFetch=global.fetch,origin='https://entangledforever.com',basePath='/api/shopping/browser';
 let server,vnc,wss,active=true,wrappedAuthorization=false;
 try {
  const source=fs.readFileSync(process.env.ENGINE_ACCESS_SOURCE||'/root/ayan/bridge/engine-access.js','utf8');
  fs.writeFileSync(path.join(dir,'engine-access.js'),source,{mode:0o600});
  global.fetch=async(input,options)=>{
   if(String(input)==='http://127.0.0.1:3000'+basePath+'/desktop-auth'){wrappedAuthorization=new Headers(options?.headers).has('authorization');return new Response('',{status:403});}
   return originalFetch(input,options);
  };
  const access=require(path.join(dir,'engine-access.js')),app=express();app.use(express.json());access.registerAccess(app,{express,isCodex:()=>false});
  register(app,{getState:async()=>({running:true,headless:false,manualActive:active}),action:async()=>({ok:true})});
  server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base+'/api/engine/unlock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:access.pairCode()})});assert(response.status===200,'isolated pairing must succeed');
  const cookie=(response.headers.get('set-cookie')||'').split(';')[0];assert(access.authorized({headers:{cookie}}),'isolated cookie validates');
  await fetch('http://127.0.0.1:3000'+basePath+'/desktop-auth',{headers:{cookie,origin}});assert(wrappedAuthorization,'reproduce automatic internal Authorization injection without production request');
  vnc=net.createServer(socket=>{socket.write('RFB-AUTH-FIXTURE');socket.on('data',data=>socket.write(data));});await new Promise(r=>vnc.listen(0,'127.0.0.1',r));
  wss=attach(server,{authorize:access.authorized,getState:async()=>({running:true,headless:false,manualActive:active}),vncPort:vnc.address().port,recheckMs:80});
  const ws=new WebSocket(base.replace('http:','ws:')+basePath+'/desktop-ws',{headers:{cookie,origin}});
  const greeting=await new Promise((resolve,reject)=>{ws.once('message',d=>resolve(d.toString()));ws.once('error',reject)});assert(greeting==='RFB-AUTH-FIXTURE','real cookie authorizer must work despite global fetch injection');
  fs.writeFileSync(path.join(dir,'rotated-access.js'),rotateSource(source,'isolated-test-next-domain'),{mode:0o600});const rotated=require(path.join(dir,'rotated-access.js'));
  assert(rotated.internal!==access.internal,'rotation must change internal access');assert(!rotated.authorized({headers:{authorization:'Bearer '+access.internal}}),'old internal access must fail');assert(rotated.authorized({headers:{authorization:'Bearer '+rotated.internal}}),'new internal access must validate');assert(rotated.authorized({headers:{cookie}}),'existing device cookie must remain valid');
  const closed=new Promise(r=>ws.once('close',r));active=false;await closed;
  console.log('PASS isolated real engine auth: reproduced injected self-fetch rejection; direct device-cookie WS succeeds; internal-domain rotation invalidates old bearer and preserves paired cookie; no production pairing/state/lease/JD requests');
 }finally{global.fetch=originalFetch;for(const ws of wss?.clients||[])ws.terminate();wss?.close();if(server)await new Promise(r=>server.close(r));if(vnc)await new Promise(r=>vnc.close(r));assert(path.resolve(dir).startsWith(path.join(path.resolve(os.tmpdir()),'ayan-auth-isolated-')));fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={rotateSource};
