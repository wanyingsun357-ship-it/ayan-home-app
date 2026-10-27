const assert=require('assert/strict'),http=require('http'),net=require('net'),crypto=require('crypto');
const {WebSocket}=require('ws');
const {attach}=require(process.env.DESKTOP_TEST_MODULE||'./shopping-browser-desktop.cjs');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
(async()=>{
 let ws,wss;const payload=crypto.randomBytes(24*1024*1024);let vncSocket;
 const vnc=net.createServer(s=>{vncSocket=s;s.on('error',()=>{});s.once('data',()=>s.write(payload));});
 const server=http.createServer();
 try{
  await listen(vnc);await listen(server);
  wss=attach(server,{authorize:()=>true,getState:async()=>({running:true,headless:false,manualActive:true}),vncPort:vnc.address().port});
  ws=new WebSocket('ws://127.0.0.1:'+server.address().port+'/api/shopping/browser/desktop-ws',{headers:{origin:'https://entangledforever.com',cookie:'ayan_device=isolated-fixture'}});
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
  let size=0;const hash=crypto.createHash('sha256');
  const received=new Promise((resolve,reject)=>{
   const deadline=setTimeout(()=>reject(Error('screen stalled')),15000);
   ws.on('message',d=>{size+=d.length;hash.update(d);if(size===payload.length){clearTimeout(deadline);resolve();}});
   ws.once('close',()=>{if(size!==payload.length){clearTimeout(deadline);reject(Error('Disconnected before complete frame: '+size));}});
  });
  ws.pause();ws.send(Buffer.from('start-fixture'));setTimeout(()=>ws.resume(),600);
  await received;assert.equal(hash.digest('hex'),crypto.createHash('sha256').update(payload).digest('hex'));assert.equal(ws.readyState,WebSocket.OPEN);
  console.log('PASS 24MiB screen burst with slow client: all bytes preserved, connection remains open');
 }finally{ws?.terminate();for(const c of wss?.clients||[])c.terminate();vncSocket?.destroy();wss?.close();await new Promise(r=>server.close(r));await new Promise(r=>vnc.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1});

