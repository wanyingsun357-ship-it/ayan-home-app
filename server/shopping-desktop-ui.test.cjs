// Separate display, browser profiles, local fixture and fake device cookie only.
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),express=require('express'),assert=require('node:assert/strict');
const {spawn}=require('child_process'),{chromium}=require('playwright'),{register,attach}=require('./shopping-browser-desktop.cjs');
const {WebSocketServer}=require('ws');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const display=spawn('/usr/bin/Xvfb',[':97','-screen','0','1360x1024x24','-nolisten','tcp','-ac'],{stdio:'ignore'});
 let vnc,fixture,client,server,wss,asr;
 try{
  await delay(500);vnc=spawn('/usr/bin/x11vnc',['-display',':97','-listen','127.0.0.1','-localhost','-no6','-rfbport','5907','-forever','-shared','-nopw','-noclipboard','-noxdamage','-quiet','-o','/dev/null'],{stdio:'ignore'});await delay(500);
  fixture=await chromium.launch({channel:'chromium',headless:false,env:{...process.env,DISPLAY:':97'},args:['--window-position=0,0','--window-size=1360,1024']});
  const target=await fixture.newPage({viewport:{width:1280,height:900}});
  await target.setContent('<html><body style="margin:0;background:#fff8ef"><label style="position:absolute;left:160px;top:180px">Fixture text <input id="text" style="width:300px;height:40px"></label><input id="range" type="range" min="0" max="100" value="0" style="position:absolute;left:160px;top:280px;width:400px;height:40px"><script>window.changes=0;document.getElementById("range").addEventListener("input",()=>window.changes++)</script></body></html>');
  let active=false;const app=express();app.use(express.json());app.use((req,res,next)=>req.headers.cookie==='ayan_device=fixture-owner'?next():res.sendStatus(401));
  server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  asr=new WebSocketServer({server,path:'/fixture-asr'});
  register(app,{origin:base,getState:async()=>({manualActive:active,running:true,headless:false}),action:async b=>{active=b.action==='desktopBegin';return{ok:true}}});
  wss=attach(server,{origin:base,authorize:req=>req.headers.cookie==='ayan_device=fixture-owner',getState:async()=>({running:true,headless:false,manualActive:active}),vncPort:5907,recheckMs:100});
  client=await chromium.launch({channel:'chromium',headless:true});const context=await client.newContext({viewport:{width:1440,height:1200}});await context.addCookies([{name:'ayan_device',value:'fixture-owner',url:base}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/api/shopping/browser/desktop');await page.getByRole('status').filter({hasText:'已连接，可以直接操作'}).waitFor({timeout:15000});
  const canvas=page.locator('#screen canvas');await canvas.waitFor();await delay(500);
  const rect=await canvas.boundingBox();const chrome=await target.evaluate(()=>({x:screenX+(outerWidth-innerWidth)/2,y:screenY+(outerHeight-innerHeight)}));
  const point=(x,y)=>({x:rect.x+(x+chrome.x)*rect.width/1360,y:rect.y+(y+chrome.y)*rect.height/1024});
  const textRect=await target.locator('#text').boundingBox(),p=point(textRect.x+30,textRect.y+20);await page.mouse.click(p.x,p.y);await page.keyboard.type('local-fixture');await delay(250);assert.equal(await target.locator('#text').inputValue(),'local-fixture');
  const range=await target.locator('#range').boundingBox(),start=point(range.x+8,range.y+20),end=point(range.x+300,range.y+20);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:20});await page.mouse.up();await delay(250);assert(Number(await target.locator('#range').inputValue())>60);assert(await target.evaluate(()=>window.changes>2));
  for(const ws of wss.clients)ws.close(1008,'fixture disconnect');await page.getByRole('status').filter({hasText:'设备连接已通过，但远程画面已断开'}).waitFor();assert((await page.locator('#retry-message').innerText()).includes('不用重新输入设备连接码'));
  await page.getByRole('button',{name:'重新连接',exact:true}).click();await page.getByRole('status').filter({hasText:'已连接，可以直接操作'}).waitFor();assert.equal(await target.locator('#text').inputValue(),'local-fixture');
  assert.deepEqual(errors,[]);await page.screenshot({path:'/root/ayan/shopping-ws-route-20261026/remote-fixture.png'});await page.getByRole('button',{name:'完成，回 Shopping'}).click();await delay(250);assert.equal(active,false);
  console.log('PASS real noVNC 1.7 + isolated Xvfb/x11vnc + Chromium: protected page loads with CSP, keyboard typing, continuous pointer drag changes ordinary fixture range, finish releases lease; no JD requests or real credentials');
 }finally{for(const ws of wss?.clients||[])ws.terminate();wss?.close();asr?.close();await client?.close();await fixture?.close();if(server)await new Promise(r=>server.close(r));vnc?.kill();display.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
