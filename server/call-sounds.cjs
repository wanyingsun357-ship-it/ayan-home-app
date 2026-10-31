'use strict';
const crypto=require('node:crypto');
const {categories:WHITELIST,humanClasses}=require('./sound-whitelist.json');
const clips=require('./sound-clips.cjs');
const notes=require('./sound-notes.cjs');
const LEGACY={laugh:{name:'笑声',threshold:.55},breath:{name:'呼吸声',threshold:.65},sigh:{name:'叹气声',threshold:.55},gasp:{name:'吸气声',threshold:.6},cry:{name:'哭声',threshold:.6}};
const CATEGORIES=Object.freeze({...WHITELIST,breath:LEGACY.breath});
// Sound hints are observations, not transcribed speech or inferred feelings.
// Only validated categories and measured acoustic descriptions enter model text.
// Opted-in hit audio is bounded and stored separately from call history.
function create({getCall,save,publish,deliver,busy,clipStore,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
 const states=new Map();
 function tally(c,key,n=1){const counts=(c.soundCounters||={});counts[key]=Math.min(1000000,(counts[key]||0)+n);}
 function state(c){if(!states.has(c.id))states.set(c.id,{callId:c.id,enabled:false,capturing:false,model:null,saveClips:false,revision:-1,epoch:0,pending:new Map(),seen:new Map(),ids:new Set(),turn:null,turnAt:now(),count:0,kinds:new Set(),timer:null});return states.get(c.id);}
 function clear(s){const c=getCall(s.callId);if(c&&s.pending.size)tally(c,'cancelled',s.pending.size);if(s.timer)cancel(s.timer);s.timer=null;s.pending.clear();s.epoch++;}
 function setting(c,{enabled,capturing,revision,model,saveClips,reason,nativeBuild}){
  if(c.status!=='active')return {ok:false,error:'call_not_active'};
  const s=state(c);if(!Number.isSafeInteger(revision)||revision<0)return {ok:false,error:'invalid_revision'};
  const selected=model==='yamnet-v1'?'yamnet-v1':null,record=selected!==null&&saveClips===true;
  if(revision<s.revision||(revision===s.revision&&(s.enabled!==(enabled===true)||s.capturing!==(enabled===true&&capturing===true)||s.model!==selected||s.saveClips!==record)))return {ok:false,error:'stale_setting'};
  if(revision!==s.revision)clear(s);
  s.model=selected;s.saveClips=record;
  s.revision=revision;s.enabled=enabled===true;s.capturing=s.enabled&&capturing===true;
  const reasons=['disabled','listening','analysis_failed','audio_inactive','muted','playback'];
  c.soundState={enabled:s.enabled,capturing:s.capturing,model:s.model,saveClips:s.saveClips,revision,reason:reasons.includes(reason)?reason:(s.capturing?'listening':s.enabled?'paused':'disabled'),nativeBuild:/^\d{1,4}$/.test(String(nativeBuild||''))?String(nativeBuild):null,updatedAt:new Date(now()).toISOString()};save();
  if(!s.capturing)clear(s);
  return {ok:true,enabled:s.enabled,capturing:s.capturing,saveClips:s.saveClips,retentionDays:s.saveClips?7:0};
 }
 function turn(c,s){
  // All sentence entries in one model reply share a turnId. Old clients/calls
  // fall back to the last counterpart entry timestamp, never to user speech.
  const entry=[...(c.entries||[])].reverse().find(e=>e.who==='him');const id=entry?.turnId||entry?.t||'initial';
  if(id!==s.turn||now()-s.turnAt>=40000){s.turn=id;s.turnAt=now();s.count=0;s.kinds.clear();}
 }
 function arm(c,s,delay){if(s.timer)return;const epoch=s.epoch;s.timer=schedule(()=>{s.timer=null;if(epoch===s.epoch)flush(c.id);},delay);s.timer?.unref?.();}
 function accept(c,event){
  tally(c,'received');
  const reject=error=>{tally(c,error);return {ok:false,error}},limit=()=>{tally(c,'limited');return {ok:true,limited:true}};
  if(c.status!=='active')return {ok:false,error:'call_not_active'};
  const s=state(c),catalog=s.model?CATEGORIES:LEGACY,category=Object.hasOwn(catalog,event?.kind)?catalog[event.kind]:null;
  if(!s.enabled||!s.capturing||event?.revision!==s.revision)return reject('sound_paused');
  const auxiliary=s.model&&event?.source==='vocal-heuristic'&&['moan','whimper','vocal'].includes(event.kind);
  let threshold=s.model?category?.classes?.[event?.classIndex]:category?.threshold;
  if(auxiliary){const e=event.evidence;threshold=.12;if(!e||e.asrWords!==false||!Number.isFinite(e.voicedRatio)||e.voicedRatio<.30||e.voicedRatio>1||!Number.isFinite(e.pitchHz)||e.pitchHz<150||e.pitchHz>700||!humanClasses.includes(event.classIndex))threshold=undefined;}
  if(!category||typeof threshold!=='number'||typeof event.eventId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(event.eventId)||typeof event.confidence!=='number'||!Number.isFinite(event.confidence)||event.confidence<threshold||event.confidence>1)return reject('invalid_sound');
  if(s.ids.has(event.eventId))return {ok:true,duplicate:true};
  s.ids.add(event.eventId);if(s.ids.size>256)s.ids.delete(s.ids.values().next().value);
  turn(c,s);if(s.count>=2||s.kinds.has(event.kind))return limit();
  if(now()-(s.seen.get(event.kind)??-Infinity)<8000)return limit();
  if(!s.pending.has(event.kind)&&s.pending.size>=2-s.count)return limit();
  let clip=null;if(s.saveClips&&event.clipWav!==undefined){try{clip=clips.decode(event.clipWav)}catch{return reject('invalid_clip');}}
  s.pending.set(event.kind,{kind:event.kind,name:category.name,confidence:event.confidence,at:now(),eventId:event.eventId,continued:event.continued===true,clip});
  tally(c,'queued');arm(c,s,1200);return {ok:true,queued:true};
 }
 function flush(id){
  const c=getCall(id),s=states.get(id);if(!c||!s||c.status!=='active'||!s.enabled||!s.capturing){if(s)clear(s);return;}
  for(const [kind,e]of s.pending)if(now()-e.at>12000){tally(c,'expired');s.pending.delete(kind);}
  if(!s.pending.size)return;
  if(busy()){tally(c,'busyChecks');arm(c,s,300);return;}
  turn(c,s);const chosen=[...s.pending.values()].filter(e=>!s.kinds.has(e.kind)&&now()-(s.seen.get(e.kind)??-Infinity)>=8000).slice(0,Math.max(0,2-s.count));
  s.pending.clear();if(!chosen.length)return;
  const names=chosen.map(e=>e.name),event={id:crypto.randomUUID(),t:new Date(now()).toISOString(),kinds:chosen.map(e=>e.kind),names,continued:chosen.some(e=>e.continued),descriptionPending:true,text:'听到了'+chosen.map(e=>e.name+(e.continued?'，还在继续':'')).join('、')};
  const saved=[];
  for(const e of chosen)if(e.clip&&clipStore){try{const recording=clipStore.save(e.clip,{callId:c.id,eventId:e.eventId,kind:e.kind});saved.push({...recording,kind:e.kind});}catch{event.clipFailed=true;}}
  if(saved.length){event.clips=saved;event.measurements=saved.map(r=>({kind:r.kind,...r.metrics}));}
  // deliver() performs the existing same-session enqueue synchronously and
  // returns false if no target is available. Never label undelivered hints sent.
  let delivered=false;try{delivered=deliver(c,event)!==false;}catch{}finally{if(!delivered)for(const r of saved)try{clipStore.remove(r.id)}catch{}}
  if(!delivered){tally(c,'deliveryFailed');return;}
  tally(c,'delivered');
  for(const e of chosen){s.seen.set(e.kind,now());s.kinds.add(e.kind);}s.count+=chosen.length;
  (c.sounds||=[]).push(event);c.sounds=c.sounds.slice(-100);save();publish(c,event);
 }
 function describe(c,source){
  for(const item of notes.extract(source)){
   const event=(c.sounds||[]).find(e=>e.id===item.id&&e.descriptionPending===true);
   if(!event||now()-Date.parse(event.t)>120000)continue;
   event.description=item.text;event.descriptionSource='model';event.descriptionPending=false;tally(c,'described');save();publish(c,event);
  }
 }
 function health(c,data){
  const s=state(c);if(c.status!=='active'||!s.capturing||data?.revision!==s.revision)return {ok:false,error:'sound_paused'};
  const fields={samples:[0,1000000000],windows:[0,1000000],rmsDbfs:[-120,0],topClass:[0,520],topConfidence:[0,1],waterConfidence:[0,1],analysisMs:[0,10000]};const diagnostic={revision:s.revision,at:new Date(now()).toISOString()};
  for(const [key,[lo,hi]]of Object.entries(fields)){const value=data[key];if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi)return {ok:false,error:'invalid_health'};diagnostic[key]=value;}
  if(!Number.isInteger(diagnostic.topClass)||!Number.isInteger(diagnostic.samples)||!Number.isInteger(diagnostic.windows))return {ok:false,error:'invalid_health'};
  if(c.soundDiagnostics&&now()-Date.parse(c.soundDiagnostics.at)<4000)return {ok:true,limited:true};
  diagnostic.voiceProcessingEnabled=data.voiceProcessingEnabled===true;diagnostic.voiceProcessingBypassed=data.voiceProcessingBypassed===true;
  c.soundDiagnostics=diagnostic;save();return {ok:true};
 }
 function close(c){const s=states.get(c.id);if(s)clear(s);states.delete(c.id);if(c.soundState)c.soundState.capturing=false;}
 return {setting,accept,close,flush,describe,health};
}
module.exports={create,CATEGORIES};
