'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/shopping-browser-worker.cjs','utf8');
const sandbox={require,module:{exports:{}},URL,Buffer,console,process:{env:{},on(){}},setTimeout};
vm.runInNewContext(source+'\nmodule.exports.test = async (target) => { page=target; context={cookies:async()=>[{name:"thor"},{name:"pin"}]}; const loggedIn=await checkAccount(); return {loggedIn,evidence:loginEvidence,error}; };',sandbox);
(async()=>{
 let samples=0;
 const target={goto:async()=>{},waitForTimeout:async()=>{},url:()=> 'https://cart.jd.com/cart_index',evaluate:async()=>{samples++;return {loginPrompt:samples<5,nickname:samples>=5,logout:false,rateLimited:false,cartUnavailable:true,cartReady:false};}};
 const result=await sandbox.module.exports.test(target);
 assert.equal(samples,16); assert.equal(result.loggedIn,true); assert.equal(result.evidence.cartReady,false); assert.match(result.error,/购物车没有加载成功/);
 samples=0; target.evaluate=async()=>{samples++;return {loginPrompt:true,nickname:false,logout:false,rateLimited:false,cartReady:false};};
 const guest=await sandbox.module.exports.test(target); assert.equal(samples,16);assert.equal(guest.loggedIn,false);
 console.log('PASS initial guest markup becomes logged-in after delay; cart failure remains separate; genuine guest stays unconfirmed');
})().catch(e=>{console.error(e);process.exitCode=1});
