const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {chunks,create}=require('./call-stream.cjs');
const first='[ANSWER][softly] Hi.[ZH]你好。[/ZH]',second='\nTake your time.[ZH]慢慢来。[/ZH]';
test('first short bilingual sentence commits before later tokens and final result',()=>{
 const c={entries:[]},events=[],tts=[],saved=[];const stream=create({save:()=>saved.push(structuredClone(c)),publish:(c,e)=>events.push(e),prefetch:t=>tts.push(t),clock:()=>1000});
 stream.feed(c,first+'\nTake your');assert.equal(c.entries.length,1);assert.equal(events.length,1);assert.equal(tts[0],'[softly] Hi.');
 stream.feed(c,first+second);assert.equal(c.entries.length,2);assert(c.entries[1].t>c.entries[0].t);
 stream.feed(c,first+second,{final:true,reasoning:'synthetic thought'});assert.equal(events.length,2);assert.equal(tts.length,2);assert(c.entries.every(e=>e.reasoning==='synthetic thought'));assert.deepEqual(c.stream,{});assert.deepEqual(saved.at(-1).stream,{});
 stream.feed(c,first,{final:true});assert.equal(c.entries.length,3,'same wording on a new turn is a real new utterance');
});
test('replay/reset and identical wording within a turn do not lose or replay sentences',()=>{
 const c={entries:[]};let n=0;const stream=create({save(){},publish(){n++},prefetch(){},clock:()=>1});
 stream.feed(c,first);stream.feed(c,first);stream.reset(c);stream.feed(c,first+first);assert.equal(n,2);assert.equal(c.entries.length,2);
 stream.feed(c,first+first,{final:true});assert.equal(n,2);
});
test('partial tags never leak to speech; legacy matching paragraphs split safely',()=>{
 const whole=first+second,seen=[];const c={entries:[]};const stream=create({save(){},publish:(c,e)=>seen.push(e),prefetch(){}});
 for(let i=0;i<=whole.length;i++){stream.feed(c,whole.slice(0,i));assert.equal(c.entries.length,i<first.length?0:i<whole.length?1:2);}
 assert.deepEqual(seen.map(e=>e.text),['[softly] Hi.','Take your time.']);
 assert.deepEqual(chunks('Hello.[ZH]你'),[]);assert.deepEqual(chunks('Hello.[ZH]你',true),[{text:'Hello.',zh:''}]);
 assert.deepEqual(chunks('One. Two.[ZH]一。二。[/ZH]'),[{text:'One.',zh:'一。'},{text:'Two.',zh:'二。'}]);
 assert.deepEqual(chunks('One. Two.[ZH]第一和第二。[/ZH]'),[{text:'One. Two.',zh:'第一和第二。'}]);
 assert.deepEqual(chunks('Bye.[ZH]再见。[/ZH][HANGUP]',true),[{text:'Bye.',zh:'再见。'}]);
 assert.deepEqual(chunks('Hello.\nStill here.',true),[{text:'Hello.\nStill here.',zh:''}]);
});
test('installed native client can fetch and play the first entry before final reply, with call-scoped authorization',async t=>{
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sentence-native-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const c={id:'outgoing',by:'her',status:'active',session:'s',entries:[]},other={id:'other',by:'her',status:'active',entries:[]},routes=new Map(),audio=[];
 const native=require('./native-calls.cjs').create({dir,authorized:()=>true,getCalls:()=>[c,other],view:c=>({...c}),saveCalls(){},audio:async text=>{audio.push(text);return '/synthetic.mp3'}});
 native.register({get:(p,f)=>routes.set('GET '+p,f),post:(p,f)=>routes.set('POST '+p,f)});const credentials=native.credentials(c);native.credentials(other);
 create({save(){},publish(){},prefetch(){}}).feed(c,first+'\nAn unfinished sentence');
 let state,status=200;const res={set(){return this},json(x){state=x},status(n){status=n;return this},sendFile(){}};
 routes.get('GET /api/native-call/state')({query:{id:c.id},headers:{authorization:'Bearer '+credentials.token}},res);
 assert.equal(state.call.entries.length,1);assert.equal(state.call.entries[0].zh,'你好。');assert.equal(state.call.entries[0].text,'[softly] Hi.');
 await routes.get('POST /api/native-call/audio')({query:{},body:{id:c.id,entryTime:state.call.entries[0].t},headers:{authorization:'Bearer '+credentials.token}},res);assert.deepEqual(audio,['[softly] Hi.']);
 routes.get('GET /api/native-call/state')({query:{id:other.id},headers:{authorization:'Bearer '+credentials.token}},res);assert.equal(status,401);
});
test('actual bridge integration: active outgoing/incoming, final metadata, late reply and controls',{skip:!process.env.AYAN_CALL_BRIDGE_SOURCE},()=>{
 const source=fs.readFileSync(process.env.AYAN_CALL_BRIDGE_SOURCE,'utf8');
 const a=source.indexOf('// Publish complete bilingual sentence pairs'),b=source.indexOf('\nfunction ringHim',a);assert(a>=0&&b>a);
 let c={id:'synthetic',by:'her',session:'s',status:'ringing',entries:[]};const events=[],sess={id:'s',messages:[{role:'user',inCall:c.id}]};
 const ctx={require:n=>{assert.equal(n,'./call-stream.cjs');return require('./call-stream.cjs')},activeCall:()=>c,calls:{calls:[c]},saveCalls(){},saveStore(){},callPub:(ev,call)=>events.push({ev,call:structuredClone(call)}),sendU:(type,data)=>events.push(JSON.parse(data)),prefetchVoices(){},store:{sessions:[sess]},endCall:(call,by)=>{call.status='ended';call.endedBy=by},console};vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);ctx.sess=sess;
 ctx.callStreamFeed(sess,first);assert.equal(c.status,'active');assert.equal(c.entries.length,1);assert(events.find(e=>e.ev==='entry'&&e.streaming));
 ctx.callStreamFeed(sess,first+second);sess.messages.push({role:'assistant',timestamp:new Date().toISOString(),reasoning:'thought'});ctx.callOnReply(sess,first+second+'[HANGUP]');assert.equal(c.entries.length,2);assert(c.hangupPending);assert.equal(events.at(-1).ev,'reply-done');assert(c.entries.every(e=>e.reasoning==='thought'));
 c.status='ended';c.endedAt=new Date().toISOString();c=null;sess.messages.at(-1).inCall=undefined;ctx.callOnReply(sess,first+second);assert.equal(ctx.calls.calls[0].entries.length,4);assert(ctx.calls.calls[0].entries.at(-1).late);
 c={id:'incoming',by:'him',status:'ringing',session:'s',entries:[]};ctx.callStreamFeed(sess,first);assert.equal(c.entries.length,0);c.status='active';ctx.callStreamFeed(sess,first);assert.equal(c.entries.length,1);
 c={id:'declined',by:'her',status:'ringing',session:'s',entries:[]};ctx.callOnReply(sess,'[DECLINE]Later.[ZH]晚点。[/ZH]');assert.equal(c.endedBy,'declined');assert.equal(c.entries.length,1);
});
