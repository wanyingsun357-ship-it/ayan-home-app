const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cart-path-'));
const sandbox={require,module:{exports:{}},URL,Buffer,console,setTimeout,clearTimeout,process:{env:{SHOPPING_PROFILE:dir},on(){}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/shopping-browser-worker.cjs','utf8')+'\nmodule.exports.test={onCart,checkAccount,setPaused,set:(p,c)=>{page=p;context=c},paused:()=>automationPaused};',sandbox);
const w=sandbox.module.exports.test;let url='',visits=0;
const p={url:()=>url,goto:async()=>{visits++},waitForTimeout:async()=>{},evaluate:async()=>({loginPrompt:false,nickname:true,logout:false,rateLimited:false,cartUnavailable:false,cartReady:true})};
w.set(p,{cookies:async()=>[{name:'thor'},{name:'pin'}]});
(async()=>{for(const u of ['https://cart.jd.com/cart_index','https://cart.jd.com/cart_index?czLogin=1','https://cart.jd.com/cart_index&czLogin=1']){url=u;assert(w.onCart());w.setPaused(true);assert(await w.checkAccount(false));assert(!w.paused());}
for(const u of ['https://evil.example/cart_index','https://cart.jd.com/cart_indexevil','https://cart.jd.com/cart_index&other=1']){url=u;assert(!w.onCart());w.setPaused(true);assert(!await w.checkAccount(false));assert(w.paused());}
assert.equal(visits,0);console.log('PASS cart login suffix, canonical/query paths, zero navigation recovery, unrelated paths rejected');})().finally(()=>fs.rmSync(dir,{recursive:true,force:true})).catch(e=>{console.error(e);process.exitCode=1});
