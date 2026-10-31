const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../src/utils/callSounds.js');
test('a stale native snapshot cannot replace the model-authored description with a category placeholder',async()=>{
 const {mergeCallSounds}=await load(),base={id:'sound-one',names:['水声'],descriptionPending:true},written={...base,description:'水流声细细地响着。',descriptionSource:'model',descriptionPending:false};
 const rows=mergeCallSounds([written],[base]);assert.equal(rows.length,1);assert.equal(rows[0].description,written.description);assert.equal(rows[0].descriptionSource,'model');assert.equal(rows[0].descriptionPending,false);
});
function entries(n,turnId='turn-one'){return Array.from({length:n},(_,i)=>({who:'him',t:new Date(1000+i).toISOString(),turnId,text:'Sentence '+i+'.',zh:'第'+i+'句。'}));}
test('same-turn short sentences group in threes, retaining a stable first-entry key and original data',async()=>{
 const {callTimeline}=await load(),raw=entries(7),copy=JSON.stringify(raw);const rows=callTimeline(raw);assert.equal(rows.length,3);assert.deepEqual(rows.map(x=>x.segmentCount),[3,3,1]);assert(rows[0].text.includes('Sentence 0. Sentence 1. Sentence 2.'));assert.equal(rows[0].rowKey,callTimeline(raw.slice(0,1))[0].rowKey);assert.equal(JSON.stringify(raw),copy);
});
test('user speech, sound hints, turn boundaries and longer bilingual content break groups',async()=>{
 const {callTimeline}=await load(),raw=entries(3);assert.equal(callTimeline([raw[0],{who:'her',t:new Date(1000.5).toISOString(),text:'我说一句'},raw[1]]).length,3);
 assert.equal(callTimeline([raw[0],{...raw[1],turnId:'other'}]).length,2);
 assert.equal(callTimeline([{...raw[0],zh:'长'.repeat(70)}, {...raw[1],zh:'长'.repeat(50)}]).length,2);
 assert.equal(callTimeline([raw[0],raw[2]],[{id:'sound',t:raw[1].t,names:['笑声']}]).length,3);
});
