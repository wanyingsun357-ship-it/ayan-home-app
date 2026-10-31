'use strict';
// A completed bilingual sentence is the unit of captions, playback and history.
// Keep the existing entryTime audio API so installed native clients can consume
// sentences before the model's result event without another native build.
const crypto=require('node:crypto');
const {strip:stripSoundNotes}=require('./sound-notes.cjs');
const clean=s=>String(s||'').replace(/\[\/?(?:ANSWER|DECLINE|HANGUP|VOICE)\]/gi,'').trim();
function sentences(s,locale){
 return [...new Intl.Segmenter(locale,{granularity:'sentence'}).segment(s)].map(x=>x.segment.trim()).filter(Boolean);
}
function pair(text,zh){
 text=clean(text);zh=String(zh||'').trim();if(!text)return [];
 // A model may ignore the one-sentence-per-pair instruction. Split only when
 // both languages have the same sentence count; never invent an alignment.
 const en=sentences(text,'en'),cn=sentences(zh,'zh');
 return en.length>1&&en.length===cn.length?en.map((text,i)=>({text,zh:cn[i]})):[{text,zh}];
}
function chunks(full,final=false){
 const source=stripSoundNotes(full),out=[];let at=0,m;
 const re=/\[ZH\]([\s\S]*?)\[\/ZH\]/gi;
 while((m=re.exec(source))){out.push(...pair(source.slice(at,m.index),m[1]));at=re.lastIndex;}
 if(final){
  // Do not speak an unfinished Chinese block or a partial control marker.
  const tail=source.slice(at).split(/\[ZH\]/i)[0].replace(/\[(?:\/?(?:ZH|ANSWER|DECLINE|HANGUP|VOICE))?$/i,'');
  const text=clean(tail);if(text)out.push({text,zh:''});
 }
 return out;
}
function create({save,publish,prefetch,clock=Date.now}){
 function feed(c,full,{final=false,reasoning,late=false}={}){
  const st=c.stream||(c.stream={});st.turnId ||= crypto.randomUUID();st.issued ||= {};
  const all=chunks(full,final),added=[];
  all.forEach((part,i)=>{
   const key=i+':'+part.text.replace(/\s+/g,' ');let entry=c.entries.find(e=>e.t===st.issued[key]);
   if(entry){if(reasoning)entry.reasoning=reasoning;return;}
   // Monotonic ISO timestamps preserve the existing who+t identity contract,
   // even when several sentences arrive together in one model/network chunk.
   const last=Date.parse(c.entries.at(-1)?.t)||0;
   const entryTime=new Date(Math.max(clock(),last+1)).toISOString();
   entry={t:entryTime,who:'him',...part,turnId:st.turnId,streamed:true,...(reasoning?{reasoning}:{}),...(late?{late:true}:{})};
   st.issued[key]=entryTime;c.entries.push(entry);added.push(entry);
   save();publish(c,entry);prefetch(part.text);
  });
  if(final){c.stream={};save();}
  return added;
 }
 function reset(c){if(c.stream)c.stream={turnId:c.stream.turnId,issued:c.stream.issued||{}};}
 return {feed,reset};
}
module.exports={chunks,create,stripSoundNotes};
