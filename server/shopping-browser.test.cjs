const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),express=require('express');
const {create}=require('./shopping.cjs'),{create:createBrowser}=require('./shopping-browser-api.cjs');
const {allowed,sku}=require('./shopping-browser-worker.cjs');
async function main(){
 assert(allowed('https://passport.jd.com/new/login.aspx'));assert(allowed('https://item.jd.com/12345.html'));
 for(const url of ['http://item.jd.com/12345.html','https://jd.com.evil.test/','https://localhost/','https://127.0.0.1/','file:///etc/passwd','https://u:p@jd.com/'])assert(!allowed(url),url);
 assert.equal(sku('12345'),'12345');for(const value of ['123','../etc/passwd','https://jd.com','1e10'])assert.throws(()=>sku(value));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ayan-browser-test-')),book=create(path.join(dir,'shopping.json'));
 const item=book.order({title:'模拟茶杯',url:'https://item.jd.com/12345.html',quantity:1,clientId:'fixture-order'}).order;
 let running=false,loginPage=false,added=false,requests=[],screenFail=false;
 const image=Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9','hex');
 const mock=express();mock.use(express.json());
 mock.get('/state',(_,res)=>res.json({available:true,running,loginPage,login:'needed',paymentsEnabled:false}));
 mock.get('/screen',(_,res)=>screenFail?res.status(503).json({error:'截图模拟失败'}):res.type('image/jpeg').send(image));mock.get('/qr',(_,res)=>res.type('image/png').send(Buffer.from('fixture-qr')));
 mock.post('/action',(req,res)=>{requests.push(req.body);running=req.body.action!=='close';loginPage=req.body.action==='login';res.json({ok:true,...(req.body.action==='add'?{added}:{}),products:req.body.action==='search'?[{skuId:'12345',title:'模拟商品',url:'https://item.jd.com/12345.html',price:'18.80'}]:undefined,state:{available:true,running,loginPage,login:'needed',url:loginPage?'https://passport.jd.com/new/login.aspx':'https://item.jd.com/12345.html',paymentsEnabled:false}})});
 const worker=mock.listen(0,'127.0.0.1');await new Promise(r=>worker.once('listening',r));
 const browser=createBrowser({shopping:book,dir,workerUrl:'http://127.0.0.1:'+worker.address().port,getSession:()=> 'fixture-home'});
 const app=express();app.use(express.json());app.use('/api/shopping',(req,res,next)=>req.headers.authorization==='Bearer fixture'||req.headers.cookie==='ayan_device=owner-fixture'?next():res.sendStatus(401));book.register(app);browser.register(app);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,headers={authorization:'Bearer fixture','content-type':'application/json'};
 async function post(body){const r=await fetch(base+'/api/shopping/browser/action',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
 try{
  for(const route of ['/api/shopping/browser','/api/shopping/browser/screen','/api/shopping/browser/qr','/api/shopping/browser/media/00000000-0000-0000-0000-000000000000.jpg'])assert.equal((await fetch(base+route)).status,401);
  assert.equal((await browser.status()).available,true);assert.equal(book.view().browserConnected,true);
  assert.equal((await post({action:'pay'})).status,400);assert.equal(requests.length,0);
  assert.equal((await post({action:'add',skuId:'12345'})).status,409);
  await post({action:'login'});assert(!fs.existsSync(path.join(dir,'shopping-browser-activities.json')),'login must not be archived');
  const qr=await fetch(base+'/api/shopping/browser/qr',{headers});assert.equal(qr.headers.get('cache-control'),'no-store');assert.equal(await qr.text(),'fixture-qr');
  assert.equal((await post({action:'loginCode',code:'123456'})).status,403);assert(!fs.existsSync(path.join(dir,'shopping-browser-activities.json')),'OTP must not be logged');
  const secret={action:'loginPassword',account:'fixture-account',password:'only-a-test-password'};
  const beforeLogin=requests.length;assert.equal((await post(secret)).status,403);assert.equal(requests.length,beforeLogin,'assistant bearer must not forward a password');
  const ownerLogin=await fetch(base+'/api/shopping/browser/action',{method:'POST',headers:{cookie:'ayan_device=owner-fixture','content-type':'application/json'},body:JSON.stringify(secret)});
  assert.equal(ownerLogin.status,200);assert.equal(ownerLogin.headers.get('cache-control'),'no-store');assert(!JSON.stringify(await ownerLogin.json()).includes(secret.password));
  assert.equal(requests.at(-1).password,secret.password);assert(!fs.existsSync(path.join(dir,'shopping-browser-activities.json')),'password login must never be archived');assert(!fs.existsSync(path.join(dir,'shopping-media')),'password login must never archive a screenshot');assert.equal((await browser.status()).activities.length,0);
  const search=await post({action:'search',query:'杯子'});assert.equal(search.status,200);assert.equal(search.body.products[0].title,'模拟商品');
  const logs=await browser.status();assert.equal(logs.activities.length,1);assert(logs.activities[0].screenshot.startsWith('/api/shopping/browser/media/'));
  const media=await fetch(base+logs.activities[0].screenshot,{headers});assert.equal(media.status,200);assert.equal(media.headers.get('cache-control'),'no-store');
  await post({action:'open',orderId:item.id});assert.equal(book.view().orders[0].status,'browsing');assert.equal(book.view().entries.length,0);
  assert(book.view().orders[0].screenshots[0].startsWith('/api/shopping/browser/media/'));
  const result=await post({action:'add',orderId:item.id,clientId:'fixture-add-operation'});assert.equal(result.status,200);assert.equal(book.view().orders[0].status,'failed');assert.equal(book.view().entries.length,0);
  assert.equal((await post({action:'add',orderId:item.id,clientId:'fixture-add-operation-again'})).status,409);
  await post({action:'cart'});added=true;await post({action:'add',orderId:item.id,clientId:'fixture-add-operation-2'});assert.equal(book.view().orders[0].status,'cart');
  const before=requests.length;assert.equal((await post({action:'add',orderId:item.id,clientId:'fixture-add-operation-3'})).status,409);assert.equal(requests.length,before);
  assert.equal(book.view().entries.length,0,'browser must not create payment expenses');
  screenFail=true;const lost=await post({action:'open',orderId:item.id});assert.equal(lost.status,502);assert(lost.body.error.includes('操作已经发生'));assert.equal((await browser.status()).activities[0].status,'unconfirmed');
  screenFail=false;const recovered=await post({action:'recordScreen',orderId:item.id});assert.equal(recovered.status,200);assert(recovered.body.activity.screenshot);assert.equal(book.view().orders[0].status,'cart');
  assert.equal(book.view().autonomy.confirmation,'not_required_within_allowance');assert.equal(book.view().autonomy.chatProgress,false);assert.equal(book.view().autonomy.footprints,true);assert.equal(book.view().autonomy.paymentsEnabled,false);
  console.log('PASS JD-only navigation, valid SKU, private media and no-store, paired-only routes, password/OTP human-only and never archived/echoed, actual add success required, duplicate cart guard, no payment actions or ledger mutations');
 }finally{await new Promise(r=>server.close(r));await new Promise(r=>worker.close(r));assert(path.resolve(dir).startsWith(path.join(path.resolve(os.tmpdir()),'ayan-browser-test-')));fs.rmSync(dir,{recursive:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
