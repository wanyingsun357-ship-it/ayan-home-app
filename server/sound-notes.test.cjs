const test=require('node:test'),assert=require('node:assert/strict');
const notes=require('./sound-notes.cjs'),{chunks,create:stream}=require('./call-stream.cjs'),{create}=require('./call-sounds.cjs');
const id='d007fc16-b3c6-4caf-8d01-69d552705890';
test('model descriptions are distinct from spoken bilingual text at every streamed boundary',()=>{
 const note=`[HEARD:${id}]水流声细细地响着。[/HEARD]`,whole=note+'I can hear the water.[ZH]我听见水声了。[/ZH]';
 assert.deepEqual(notes.extract(whole),[{id,text:'水流声细细地响着。'}]);const c={entries:[]},tts=[];const parser=stream({save(){},publish(){},prefetch:s=>tts.push(s)});
 for(let i=0;i<=whole.length;i++){parser.feed(c,whole.slice(0,i));assert(c.entries.every(e=>!e.text.includes('HEARD')&&!e.text.includes('水流声')));}
 parser.feed(c,whole,{final:true});assert.deepEqual(tts,['I can hear the water.']);assert.equal(c.entries.length,1);assert.equal(c.entries[0].zh,'我听见水声了。');
 for(let i=0;i<=note.length;i++)assert.deepEqual(chunks(note.slice(0,i),true),[]);
 assert.equal(notes.strip('Hello.[ZH]你好。[/ZH]'+note),'Hello.[ZH]你好。[/ZH]');
 assert.equal(notes.strip(`[HEARD:${id}]unfinished`),'');
 assert.equal(notes.strip('Hello.[/HEARD]'),'Hello.');
});
test('description attaches only to its pending call event, once, with no template or second message',()=>{
 let clock=100000,delivered=[],published=[],saves=0;const c={id:'call-a',status:'active',entries:[]},other={id:'call-b',status:'active',entries:[]};
 const api=create({getCall:()=>c,save:()=>saves++,publish:(c,e)=>published.push(structuredClone(e)),deliver:(c,e)=>{delivered.push(structuredClone(e));return true},busy:()=>false,now:()=>clock,schedule:()=>({unref(){}}),cancel(){}});
 api.setting(c,{enabled:true,capturing:true,revision:1,model:'yamnet-v1'});api.accept(c,{kind:'water',classIndex:282,confidence:.8,revision:1,eventId:'synthetic-water-event'});api.flush(c.id);
 const event=c.sounds[0];assert.equal(event.description,undefined);assert(event.descriptionPending);assert.equal(delivered.length,1);const full=`[HEARD:${event.id}]水流声持续响着。[/HEARD]`;
 api.describe(other,full);assert.equal(event.description,undefined);api.describe(c,`[HEARD:${id}]wrong id[/HEARD]`);assert.equal(event.description,undefined);
 api.describe(c,full);assert.equal(event.description,'水流声持续响着。');assert.equal(event.descriptionSource,'model');assert.equal(published.length,2);assert.equal(published[0].id,published[1].id);assert.equal(delivered.length,1);
 api.describe(c,full);assert.equal(published.length,2);api.describe(c,`[HEARD:${event.id}]other[/HEARD]`);assert.equal(event.description,'水流声持续响着。');
 assert(notes.instruction(event).includes(`[HEARD:${event.id}]`));assert(!notes.instruction(event).includes('clipWav'));
});
test('malformed/oversized notes cannot become display text or fabricated observations',()=>{
 assert.deepEqual(notes.extract('[HEARD:not-a-real-id]fake[/HEARD]'),[]);assert.deepEqual(notes.extract(`[HEARD:${id}]${'x'.repeat(161)}[/HEARD]`),[]);
 assert.deepEqual(notes.extract(`[HEARD:${id}][ZH]水声[/ZH]\n[/HEARD]`),[{id,text:'水声'}]);
});
test('capture state and bounded diagnostics identify missing audio/model hits without retaining unrecognized audio',()=>{
 let clock=100000;const c={id:'call-a',status:'active',entries:[]};const api=create({getCall:()=>c,save(){},publish(){},deliver(){},busy:()=>false,now:()=>clock});
 api.setting(c,{enabled:true,capturing:true,revision:4,model:'yamnet-v1'});assert.equal(c.soundState.capturing,true);
 const data={revision:4,samples:16000,windows:1,rmsDbfs:-30,topClass:364,topConfidence:.4,waterConfidence:.4,analysisMs:35,voiceProcessingEnabled:true,voiceProcessingBypassed:true,text:'DO_NOT_KEEP',clipWav:'DO_NOT_KEEP'};
 assert.equal(api.health(c,{...data,revision:3}).error,'sound_paused');assert.equal(api.health(c,{...data,waterConfidence:2}).error,'invalid_health');assert(api.health(c,data).ok);assert.equal(c.soundDiagnostics.waterConfidence,.4);assert(!JSON.stringify(c).includes('DO_NOT_KEEP'));
 assert(api.health(c,data).limited);api.setting(c,{enabled:true,capturing:false,revision:5,model:'yamnet-v1'});assert.equal(api.health(c,{...data,revision:5}).error,'sound_paused');api.close(c);assert.equal(c.soundState.capturing,false);
});
