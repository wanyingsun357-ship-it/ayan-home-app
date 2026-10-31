const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {create,decode,metrics,TTL}=require('./sound-clips.cjs'),sounds=require('./call-sounds.cjs'),rules=require('./sound-whitelist.json');
function wave(seconds=3.5,hz=220){const n=Math.floor(seconds*16000),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(1000*Math.sin(2*Math.PI*hz*i/16000)),44+2*i);return b;}
test('only bounded canonical 16k mono PCM WAV is accepted; metrics measure the actual signal',()=>{
 const b=wave(),m=metrics(decode(b.toString('base64')));assert.equal(m.duration,3.5);assert(Math.abs(m.pitchHz-220)<8);assert.equal(m.pitchTrend,'steady');assert(m.rmsDbfs<-30&&m.rmsDbfs>-36);
 for(const sample of [wave(.9),wave(3.6),Buffer.alloc(32044),Buffer.from('RIFF untrusted')])assert.throws(()=>decode(sample.toString('base64')));
 for(const offset of [4,16,20,22,24,28,32,34,40]){const bad=Buffer.from(b);bad[offset]^=255;assert.throws(()=>decode(bad.toString('base64')));}
 assert.throws(()=>decode(b.toString('base64')+'\n'));assert.throws(()=>decode('A'.repeat(200000)));
});
test('private clip retention runs at startup and on a timer, removes both files at exactly seven days',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'call-clips-'));let clock=100000,tick;try{
  const api=create({dir,now:()=>clock,interval:fn=>{tick=fn;return {unref(){}}}});const stored=api.save(wave(),{callId:'synthetic-call',eventId:'only-this-event',kind:'water'});
  assert.equal(fs.readdirSync(dir).length,2);assert.equal(Date.parse(stored.expiresAt),clock+TTL);assert(!JSON.stringify(stored).includes('base64'));clock+=TTL-1;tick();assert.equal(fs.readdirSync(dir).length,2);clock++;tick();assert.equal(fs.readdirSync(dir).length,0);
  const orphan='00000000-0000-0000-0000-000000000000.wav';fs.writeFileSync(path.join(dir,orphan),'orphan');create({dir,now:()=>clock,interval:()=>({unref(){}})});assert.equal(fs.readdirSync(dir).length,0,'startup clears crash orphans');
  assert.throws(()=>create({dir:path.join(dir,'public')}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('all tutorial whitelist classes honor their own thresholds, auxiliary evidence cannot bypass gates',()=>{
 let c={id:'test',status:'active',entries:[]};let i=0;
 function fixture(){return sounds.create({getCall:()=>c,save(){},publish(){},deliver(){return true},busy:()=>false,schedule:()=>({unref(){}}),cancel(){}});}
 for(const [kind,category]of Object.entries(rules.categories))for(const [index,threshold]of Object.entries(category.classes)){
  const api=fixture();api.setting(c,{enabled:true,capturing:true,revision:1,model:'yamnet-v1'});const event={eventId:'test-event-'+String(++i).padStart(10,'0'),kind,classIndex:Number(index),confidence:threshold,revision:1};
  assert.equal(api.accept(c,{...event,confidence:threshold-.001}).error,'invalid_sound');assert(api.accept(c,event).queued,`${kind} ${index}`);
 }
 const api=fixture();api.setting(c,{enabled:true,capturing:true,revision:1,model:'yamnet-v1'});const e={eventId:'synthetic-heuristic',kind:'moan',classIndex:0,confidence:.2,source:'vocal-heuristic',revision:1,evidence:{asrWords:false,voicedRatio:.6,pitchHz:220}};
 for(const evidence of [{...e.evidence,asrWords:true},{...e.evidence,pitchHz:90},{...e.evidence,voicedRatio:.1},{}])assert.equal(api.accept(c,{...e,evidence}).error,'invalid_sound');assert.equal(api.accept(c,{...e,classIndex:517}).error,'invalid_sound');assert(api.accept(c,e).queued);
});
test('audio only persists for a consented, delivered current-epoch hit; pause, duplicate, limit and expiry never write clips',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sound-privacy-'));let clock=100000,working=false,canDeliver=true;let event=0;
 try{
  const store=create({dir,now:()=>clock,interval:()=>({unref(){}})}),c={id:'test',status:'active',entries:[]};const api=sounds.create({getCall:()=>c,save(){},publish(){},deliver(){return canDeliver},busy:()=>working,clipStore:store,now:()=>clock,schedule:()=>({unref(){}}),cancel(){}});
  const setting=(revision,extra={})=>api.setting(c,{enabled:true,capturing:true,revision,model:'yamnet-v1',saveClips:true,...extra});
  const hit=(revision,extra={})=>({eventId:'clip-synthetic-hit-'+(++event),kind:'water',classIndex:282,confidence:.8,revision,clipWav:wave().toString('base64'),...extra});
  assert.equal(api.accept(c,hit(1)).error,'sound_paused');setting(1);api.accept(c,hit(1));setting(2,{capturing:false});api.flush(c.id);assert.equal(fs.readdirSync(dir).length,0);
  setting(3);api.accept(c,hit(3));clock+=13000;api.flush(c.id);assert.equal(fs.readdirSync(dir).length,0);
  api.accept(c,hit(3));canDeliver=false;api.flush(c.id);assert.equal(fs.readdirSync(dir).length,0);
  canDeliver=true;const accepted=hit(3);assert(api.accept(c,accepted).queued);api.flush(c.id);assert.equal(fs.readdirSync(dir).length,2);assert.equal(c.sounds[0].clips[0].metrics.duration,3.5);assert.equal(c.sounds[0].description,undefined);assert.equal(c.sounds[0].measurements[0].duration,3.5);assert(c.sounds[0].descriptionPending);assert(!JSON.stringify(c).includes('RIFF'));assert(!JSON.stringify(c).includes('clipWav'));
  assert(api.accept(c,accepted).duplicate);assert(api.accept(c,hit(3)).limited);api.flush(c.id);assert.equal(fs.readdirSync(dir).length,2);
  c.entries.push({who:'him',turnId:'next'});clock+=8100;setting(4,{saveClips:false});api.accept(c,hit(4));api.flush(c.id);assert.equal(fs.readdirSync(dir).length,2,'category-only requests do not persist audio');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
