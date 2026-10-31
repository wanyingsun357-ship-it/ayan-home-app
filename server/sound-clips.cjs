'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const TTL=7*24*60*60*1000;
function decode(encoded){
 if(typeof encoded!=='string'||encoded.length>149400||encoded.length<42728||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw Error('invalid_clip');
 const b=Buffer.from(encoded,'base64');
 if(b.toString('base64')!==encoded||b.length<32044||b.length>112044||b.toString('ascii',0,4)!=='RIFF'||b.readUInt32LE(4)!==b.length-8||b.toString('ascii',8,12)!=='WAVE'||b.toString('ascii',12,16)!=='fmt '||b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==1||b.readUInt16LE(22)!==1||b.readUInt32LE(24)!==16000||b.readUInt32LE(28)!==32000||b.readUInt16LE(32)!==2||b.readUInt16LE(34)!==16||b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==b.length-44||(b.length-44)%2)throw Error('invalid_clip');
 return b;
}
function metrics(b){
 const n=(b.length-44)/2,x=new Float32Array(n);let sum=0,peak=0;
 for(let i=0;i<n;i++){x[i]=b.readInt16LE(44+2*i)/32768;sum+=x[i]*x[i];peak=Math.max(peak,Math.abs(x[i]));}
 const levels=[];for(let i=0;i+320<=n;i+=320){let energy=0;for(let j=0;j<320;j++)energy+=x[i+j]*x[i+j];levels.push(Math.sqrt(energy/320));}
 const gate=Math.max(.003,Math.sqrt(sum/n)*.45);let active=0,onsets=0,last=-20;
 for(let i=0;i<levels.length;i++)if(levels[i]>gate){active++;if((i===0||levels[i-1]<=gate)&&i-last>=6){onsets++;last=i;}}
 const pitches=[];
 // YIN over 32ms frames: values are acoustic measurements, not emotions.
 for(let offset=0;offset+512<=n;offset+=320){
  let energy=0;for(let i=0;i<512;i++)energy+=x[offset+i]*x[offset+i];if(energy/512<1e-5)continue;
  const diff=new Float64Array(108);let total=0;
  for(let tau=1;tau<=107;tau++){let d=0;for(let j=0;j<400;j++){const v=x[offset+j]-x[offset+j+tau];d+=v*v;}diff[tau]=d;}
  for(let tau=1;tau<=107;tau++){total+=diff[tau];diff[tau]=total>0?diff[tau]*tau/total:1;}
  for(let tau=23;tau<=107;tau++)if(diff[tau]<.35){while(tau<107&&diff[tau+1]<diff[tau])tau++;pitches.push({at:offset/16000,hz:16000/tau});break;}
 }
 const round=v=>Math.round(v*100)/100,db=v=>round(20*Math.log10(Math.max(v,1e-6)));
 let pitchTrend='unknown',pitchHz=null;
 if(pitches.length>=5){const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];pitchHz=round(median(pitches.map(p=>p.hz)));const k=Math.max(1,Math.floor(pitches.length/3)),first=median(pitches.slice(0,k).map(p=>p.hz)),last=median(pitches.slice(-k).map(p=>p.hz));pitchTrend=last/first>1.15?'rising':last/first<.87?'falling':'steady';}
 return {duration:round(n/16000),activeDuration:round(active*.02),rmsDbfs:db(Math.sqrt(sum/n)),peakDbfs:db(peak),onsetsPerSecond:round(onsets/(n/16000)),pitchHz,pitchTrend};
}
function create({dir,now=Date.now,interval=setInterval}){
 if(!path.isAbsolute(dir)||dir.split(path.sep).includes('public'))throw Error('private_clip_directory_required');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.chmodSync(dir,0o700);
 let expiryTimer,earliest=Infinity;
 function armExpiry(at){
  if(at>=earliest)return;earliest=at;clearTimeout(expiryTimer);
  expiryTimer=setTimeout(()=>{earliest=Infinity;sweep();},Math.max(1,at-now()));expiryTimer.unref?.();
 }
 function sweep(){
  let next=Infinity;
  for(const name of fs.readdirSync(dir))if(/^[a-f0-9-]{36}\.(wav|json)$/.test(name)){
   const file=path.join(dir,name),stem=file.replace(/\.(wav|json)$/,'');
   let expired=true;try{const info=JSON.parse(fs.readFileSync(stem+'.json','utf8'));expired=!Number.isFinite(info.createdAt)||info.createdAt>now()||now()-info.createdAt>=TTL;if(!expired)next=Math.min(next,info.createdAt+TTL);}catch{}
   if(expired){for(const ext of ['.wav','.json'])try{fs.unlinkSync(stem+ext)}catch(e){if(e.code!=='ENOENT')throw e;}}
  }
  clearTimeout(expiryTimer);earliest=Infinity;if(Number.isFinite(next))armExpiry(next);
 }
 sweep();const timer=interval(sweep,15*60*1000);timer?.unref?.();
 function save(buffer,{callId,eventId,kind}){
  const id=crypto.randomUUID(),createdAt=now(),measurement=metrics(buffer),file=path.join(dir,id);
  try{
   fs.writeFileSync(file+'.wav',buffer,{mode:0o600,flag:'wx'});
   fs.writeFileSync(file+'.json',JSON.stringify({id,callId,eventId,kind,createdAt,expiresAt:createdAt+TTL,metrics:measurement}),{mode:0o600,flag:'wx'});
  }catch(e){for(const ext of ['.wav','.json'])try{fs.unlinkSync(file+ext)}catch{}throw e;}
  armExpiry(createdAt+TTL);
  return {id,expiresAt:new Date(createdAt+TTL).toISOString(),metrics:measurement};
 }
 function remove(id){if(!/^[a-f0-9-]{36}$/.test(id))return;for(const ext of ['.wav','.json'])try{fs.unlinkSync(path.join(dir,id+ext))}catch(e){if(e.code!=='ENOENT')throw e;}}
 return {save,remove,sweep,close:()=>{clearInterval(timer);clearTimeout(expiryTimer)}};
}
module.exports={create,decode,metrics,TTL};
