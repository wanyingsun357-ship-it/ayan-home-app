'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function create({dir,authorized,getCalls,view,saveCalls,answer,say,end,audio,sendPush}){
 const file=path.join(dir,'native-push.json');let devices=[];
 try{devices=JSON.parse(fs.readFileSync(file,'utf8')).devices||[];}catch{}
 const save=()=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify({devices}),{mode:0o600});fs.renameSync(tmp,file);};
 function credentials(c){
  if(!c.nativeUUID||!c.nativeToken){c.nativeUUID=crypto.randomUUID();c.nativeToken=crypto.randomBytes(32).toString('hex');saveCalls();}
  return {callId:c.id,session:c.session,uuid:c.nativeUUID,token:c.nativeToken,caller:'晏白',startedAt:c.startedAt};
 }
 function authenticate(req,res){
  const id=req.body?.id||req.query?.id;const c=getCalls().find(x=>x.id===id&&(x.by==='him'||x.by==='her'));
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const expected=c?.nativeToken||'';
  if(!c||!/^[a-f0-9]{64}$/.test(token)||token.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected))||(c.status==='ended'&&Date.now()-Date.parse(c.endedAt||0)>120000)){res.status(401).json({error:'native_call_unauthorized'});return null;}
  return c;
 }
 function register(app){
  // Register these narrow, independently authenticated endpoints before engine-access.
  app.post('/api/native-call/register',(req,res)=>{
   if(!authorized(req))return res.status(401).json({error:'device_pairing_required'});
   const {deviceId,token,apnsToken,environment}=req.body||{};
   if(!/^[a-zA-Z0-9-]{16,80}$/.test(deviceId||'')||!/^[a-fA-F0-9]{64,512}$/.test(token||''))return res.status(400).json({error:'invalid_device'});
   const old=devices.find(x=>x.deviceId===deviceId);
   devices=devices.filter(x=>x.deviceId!==deviceId&&x.token!==token);
   devices.push({deviceId,token,apnsToken:/^[a-fA-F0-9]{64,512}$/.test(apnsToken||'')?apnsToken:old?.apnsToken||null,environment:environment==='sandbox'?'sandbox':'production',at:new Date().toISOString()});
   devices=devices.slice(-12);save();res.json({ok:true});
  });
  app.get('/api/native-call/credentials',(req,res)=>{
   res.set('Cache-Control','no-store');
   if(!authorized(req))return res.status(401).json({error:'device_pairing_required'});
   const c=getCalls().find(x=>x.id===req.query.id&&x.by===(req.query.direction==='outgoing'?'her':'him')&&x.status!=='ended');
   if(!c)return res.status(410).json({error:'no_incoming_call'});
   res.json({native:credentials(c),call:view(c)});
  });
  app.get('/api/native-call/state',(req,res)=>{
   res.set('Cache-Control','no-store');const c=authenticate(req,res);if(!c)return;
   // The per-call key grants only this call, not chat history or model access.
   const data=view(c);data.entries=(c.entries||[]).map(({t,who,text,zh,via})=>({t,who,text,zh,via}));data.speech=c.nativeSpeech||[];
   res.json({call:data,serverNow:Date.now()});
  });
  app.post('/api/native-call/action',(req,res)=>{
   const c=authenticate(req,res);if(!c)return;
   if(req.body.action==='answer'){
    if(c.status==='active')return res.json({ok:true,call:view(c)});
    if(c.status!=='ringing')return res.status(410).json({error:'call_ended'});
    return answer(c.id,res);
   }
   if(req.body.action==='end'||req.body.action==='decline'){
    end(c,req.body.action==='decline'?'declined':'her');return res.json({ok:true,call:view(c)});
   }
   if(req.body.action==='played-hangup'&&c.hangupPending){end(c,'him');return res.json({ok:true,call:view(c)});}
   res.status(400).json({error:'unknown_action'});
  });
  app.post('/api/native-call/say',(req,res)=>{
   const c=authenticate(req,res);if(!c)return;
   return say(c.id,String(req.body.text||'').slice(0,4000),res);
  });
  app.post('/api/native-call/audio',async(req,res)=>{
   const c=authenticate(req,res);if(!c)return;
   const e=(c.nativeSpeech||[]).find(x=>x.id===req.body.speechId)||(c.entries||[]).find(x=>x.who==='him'&&x.t===req.body.entryTime);
   if(!e)return res.status(404).json({error:'no_call_audio'});
   try{const f=await audio(e.text);res.set('Content-Type','audio/mpeg');res.sendFile(f);}catch{res.status(502).json({error:'speech_unavailable'});}
  });
 }
 async function ring(c){
  const info=credentials(c),delivered=[];
  for(const d of [...devices]){
   let r;try{r=await sendPush(d.token,{aps:{},kind:'native-call',...info},'voip',d.environment);}catch{continue;}
   if(r.status===200&&d.apnsToken)delivered.push(d.apnsToken);
   if(r.status===410||(r.status===400&&/BadDeviceToken/.test(r.body||''))){devices=devices.filter(x=>x.token!==d.token);save();}
  }
  return delivered;
 }
 function addSegment(c,text,id=crypto.randomUUID()){
  if(c.by!=='him'||!String(text||'').trim())return;
  if((c.nativeSpeech||[]).some(segment=>segment.id===id))return;
  (c.nativeSpeech||=[]).push({id,text:String(text),zh:''});c.nativeSpeech=c.nativeSpeech.slice(-200);saveCalls();
 }
 function completeSpeech(c,text,segs=[]){
  let tail=String(text||'').replace(/\s+/g,' ').trim();
  for(const raw of segs){const seg=String(raw).replace(/\s+/g,' ').trim();const at=tail.indexOf(seg);if(at>=0)tail=(tail.slice(0,at)+tail.slice(at+seg.length)).trim();}
  if(tail)addSegment(c,tail);
 }
 return{register,ring,credentials,addSegment,completeSpeech};
}
module.exports={create};
