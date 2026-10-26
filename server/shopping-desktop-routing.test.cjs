'use strict';
const assert=require('node:assert/strict'),http=require('http'),net=require('net');
const {WebSocket,WebSocketServer}=require('ws'),{attach}=require('./shopping-browser-desktop.cjs');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
async function main(){
 const server=http.createServer((req,res)=>res.end('fixture'));await listen(server);const base='ws://127.0.0.1:'+server.address().port;
 const asr=new WebSocketServer({server,path:'/fixture-asr'});asr.on('connection',ws=>{ws.send('ASR-FIXTURE');ws.on('message',d=>ws.send(d))});
 let lastRoute;
 const rejected=(url,headers={})=>new Promise((resolve,reject)=>{const ws=new WebSocket(url,{headers});ws.once('unexpected-response',(req,res)=>{lastRoute=res.headers['x-ayan-desktop-route'];res.resume();req.destroy();resolve(res.statusCode)});ws.once('open',()=>{ws.close();reject(Error('unexpected accepted connection'))});ws.once('error',()=>{})});
 const socket=async(url,headers={})=>{const ws=new WebSocket(url,{headers});const greeting=await new Promise((resolve,reject)=>{ws.once('message',d=>resolve(d.toString()));ws.once('error',reject)});return{ws,greeting}};
 let vnc,desktop;
 try{
  // This is how ws's existing server-bound path listener behaves before the router.
  assert.equal(await rejected(base+'/api/shopping/browser/desktop-ws'),400);
  vnc=net.createServer(s=>{s.write('RFB-ROUTE-FIXTURE');s.on('data',d=>s.write(d))});await listen(vnc);
  desktop=attach(server,{authorize:req=>req.headers.cookie==='ayan_device=route-fixture',getState:async()=>({running:true,headless:false,manualActive:true}),vncPort:vnc.address().port});
  const headers={cookie:'ayan_device=route-fixture',origin:'https://entangledforever.com'};
  assert.equal(await rejected(base+'/api/shopping/browser/desktop-ws',{origin:headers.origin}),403);
  assert.equal(lastRoute,'owner','diagnostic marker identifies the actual protected desktop route');
  const remote=await socket(base+'/api/shopping/browser/desktop-ws',headers);assert.equal(remote.greeting,'RFB-ROUTE-FIXTURE');
  const audio=await socket(base+'/fixture-asr');assert.equal(audio.greeting,'ASR-FIXTURE');
  const audioEcho=new Promise(r=>audio.ws.once('message',d=>r(d.toString())));audio.ws.send(Buffer.from('ordinary-binary-audio-fixture'));assert.equal(await audioEcho,'ordinary-binary-audio-fixture');
  const pointer=new Promise(r=>remote.ws.once('message',d=>r(d.toString())));remote.ws.send(Buffer.from('ordinary-pointer-fixture'));assert.equal(await pointer,'ordinary-pointer-fixture');
  assert.equal(await rejected(base+'/unrelated-path'),400,'existing unknown-path policy stays intact');
  remote.ws.close();audio.ws.close();
  console.log('PASS reproduced server-bound ASR listener rejecting desktop with 400; shared routing now enforces desktop auth and delivers VNC while existing ASR accepts/echoes binary data concurrently; unknown path policy preserved');
 }finally{for(const ws of [...(desktop?.clients||[]),...asr.clients])ws.terminate();desktop?.close();asr.close();await new Promise(r=>server.close(r));if(vnc)await new Promise(r=>vnc.close(r));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
