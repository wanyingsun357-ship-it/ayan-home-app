const assert=require('node:assert/strict');
const {hasSession,confirmedLogin,captureScreen}=require('./shopping-browser-worker.cjs');
(async()=>{
 assert(hasSession(['thor','pin']));assert(hasSession(['pt_key','pt_pin']));assert(!hasSession(['pin']));assert(!hasSession(['__jdu']));
 assert(!confirmedLogin({session:true,nickname:false,logout:false,loginPrompt:false,redirected:false}));
 assert(confirmedLogin({session:true,nickname:true,loginPrompt:false,redirected:false}));
 assert(confirmedLogin({logout:true,loginPrompt:false,redirected:false}));
 assert(!confirmedLogin({nickname:true,loginPrompt:true,redirected:false}));assert(!confirmedLogin({nickname:true,redirected:true}));
 let restored=0,disposed=0,detached=0,options;
 const page={evaluateHandle:async()=>({dispose:async()=>disposed++}),evaluate:async()=>restored++};
 const context={newCDPSession:async()=>({send:async(name,value)=>{assert.equal(name,'Page.captureScreenshot');options=value;return {data:Buffer.from('image-fixture').toString('base64')}},detach:async()=>detached++})};
 assert.equal((await captureScreen(page,context)).toString(),'image-fixture');assert.equal(options.format,'jpeg');assert.equal(options.captureBeyondViewport,false);assert.equal(restored,1);assert.equal(disposed,1);assert.equal(detached,1);
 await captureScreen(page,context,{format:'png',clip:{x:1,y:2,width:100,height:100}});assert.equal(options.format,'png');assert.equal(options.clip.scale,1);assert(!('quality' in options));
 await assert.rejects(()=>captureScreen(page,{newCDPSession:async()=>({send:async()=>{throw Error('capture failed')},detach:async()=>detached++})}));
 assert.equal(restored,3);assert.equal(disposed,3);assert.equal(detached,3);
 console.log('PASS desktop/mobile cookie markers, session alone never confirms login, guest and redirect guards, CDP screenshot and cropped QR without font wait, privacy masks restored on success/failure');
})().catch(e=>{console.error(e);process.exitCode=1});
