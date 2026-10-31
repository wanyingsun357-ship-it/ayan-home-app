'use strict';
const crypto=require('node:crypto');
const CATEGORIES=Object.freeze({laugh:{name:'笑声',threshold:.55},breath:{name:'呼吸声',threshold:.65},sigh:{name:'叹气声',threshold:.55},gasp:{name:'吸气声',threshold:.6},cry:{name:'哭声',threshold:.6}});
// Sound hints are observations, not transcribed speech or inferred feelings.
// No audio, free-form text, URLs or client-provided descriptions enter this path.
function create({getCall,save,publish,deliver,busy,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
 const states=new Map();
 function state(c){if(!states.has(c.id))states.set(c.id,{enabled:false,capturing:false,revision:-1,epoch:0,pending:new Map(),seen:new Map(),ids:new Set(),turn:null,turnAt:now(),count:0,kinds:new Set(),timer:null});return states.get(c.id);}
 function clear(s){if(s.timer)cancel(s.timer);s.timer=null;s.pending.clear();s.epoch++;}
 function setting(c,{enabled,capturing,revision}){
  if(c.status!=='active')return {ok:false,error:'call_not_active'};
  const s=state(c);if(!Number.isSafeInteger(revision)||revision<0)return {ok:false,error:'invalid_revision'};
  if(revision<s.revision||(revision===s.revision&&(s.enabled!==(enabled===true)||s.capturing!==(enabled===true&&capturing===true))))return {ok:false,error:'stale_setting'};
  s.revision=revision;s.enabled=enabled===true;s.capturing=s.enabled&&capturing===true;
  if(!s.capturing)clear(s);
  return {ok:true,enabled:s.enabled,capturing:s.capturing};
 }
 function turn(c,s){
  // All sentence entries in one model reply share a turnId. Old clients/calls
  // fall back to the last counterpart entry timestamp, never to user speech.
  const entry=[...(c.entries||[])].reverse().find(e=>e.who==='him');const id=entry?.turnId||entry?.t||'initial';
  if(id!==s.turn||now()-s.turnAt>=40000){s.turn=id;s.turnAt=now();s.count=0;s.kinds.clear();}
 }
 function arm(c,s,delay){if(s.timer)return;const epoch=s.epoch;s.timer=schedule(()=>{s.timer=null;if(epoch===s.epoch)flush(c.id);},delay);s.timer?.unref?.();}
 function accept(c,event){
  if(c.status!=='active')return {ok:false,error:'call_not_active'};
  const s=state(c),category=Object.hasOwn(CATEGORIES,event?.kind)?CATEGORIES[event.kind]:null;
  if(!s.enabled||!s.capturing||event?.revision!==s.revision)return {ok:false,error:'sound_paused'};
  if(!category||typeof event.eventId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(event.eventId)||typeof event.confidence!=='number'||!Number.isFinite(event.confidence)||event.confidence<category.threshold||event.confidence>1)return {ok:false,error:'invalid_sound'};
  if(s.ids.has(event.eventId))return {ok:true,duplicate:true};
  s.ids.add(event.eventId);if(s.ids.size>256)s.ids.delete(s.ids.values().next().value);
  turn(c,s);if(s.count>=2||s.kinds.has(event.kind))return {ok:true,limited:true};
  if(now()-(s.seen.get(event.kind)??-Infinity)<8000)return {ok:true,limited:true};
  s.pending.set(event.kind,{kind:event.kind,name:category.name,confidence:event.confidence,at:now()});
  arm(c,s,1200);return {ok:true,queued:true};
 }
 function flush(id){
  const c=getCall(id),s=states.get(id);if(!c||!s||c.status!=='active'||!s.enabled||!s.capturing){if(s)clear(s);return;}
  for(const [kind,e]of s.pending)if(now()-e.at>12000)s.pending.delete(kind);
  if(!s.pending.size)return;
  if(busy()){arm(c,s,300);return;}
  turn(c,s);const chosen=[...s.pending.values()].filter(e=>!s.kinds.has(e.kind)&&now()-(s.seen.get(e.kind)??-Infinity)>=8000).slice(0,Math.max(0,2-s.count));
  s.pending.clear();if(!chosen.length)return;
  const names=chosen.map(e=>e.name),event={id:crypto.randomUUID(),t:new Date(now()).toISOString(),kinds:chosen.map(e=>e.kind),names,text:'听到了'+names.join('、')};
  // deliver() performs the existing same-session enqueue synchronously and
  // returns false if no target is available. Never label undelivered hints sent.
  if(deliver(c,event)===false)return;
  for(const e of chosen){s.seen.set(e.kind,now());s.kinds.add(e.kind);}s.count+=chosen.length;
  (c.sounds||=[]).push(event);c.sounds=c.sounds.slice(-100);save();publish(c,event);
 }
 function close(c){const s=states.get(c.id);if(s)clear(s);states.delete(c.id);}
 return {setting,accept,close,flush};
}
module.exports={create,CATEGORIES};
