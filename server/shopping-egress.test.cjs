const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const source=fs.readFileSync(process.env.SHOPPING_TEST_WORKER||path.join(__dirname,'shopping-browser-worker.cjs'),'utf8');
 const literal=source.match(/launchPersistentContext\(PROFILE, (\{.*\})\);/)[1];
 const opts=Function('PROXY','return ('+literal+')')('socks5://127.0.0.1:3026');opts.headless=true;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shopping-egress-test-'));let c;
 try{c=await chromium.launchPersistentContext(dir,opts);const p=c.pages()[0];
 await p.goto('https://myip.ipip.net',{waitUntil:'domcontentloaded',timeout:30000});
 const text=await p.locator('body').innerText();assert.ok(text.includes('121.43.185.197'));console.log('Chromium Hangzhou egress verified');
 await c.close();c=null;
 opts.proxy.server='socks5://127.0.0.1:1';c=await chromium.launchPersistentContext(dir,opts);
 let failed=false;try{await c.pages()[0].goto('https://myip.ipip.net',{timeout:10000});}catch(e){failed=/PROXY_CONNECTION_FAILED|SOCKS_CONNECTION_FAILED/.test(e.message);}
 assert.ok(failed);console.log('Proxy unavailable fails closed; no JD requests');
 }finally{await c?.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
