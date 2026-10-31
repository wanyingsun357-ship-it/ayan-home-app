export function mergeCallSounds(current=[],incoming=[]){
 const byId=new Map()
 for(const event of [...current,...incoming])if(event&&typeof event.id==='string'&&Array.isArray(event.names)&&event.names.length)byId.set(event.id,event)
 return [...byId.values()].slice(-100)
}
export function callTimeline(entries=[],sounds=[]){
 const rows=[...entries.map((entry,i)=>({...entry,rowKey:`${entry.who}|${entry.t||i}`})),...mergeCallSounds([],sounds).map(sound=>({...sound,sound:true,rowKey:'sound|'+sound.id}))]
 return rows.sort((a,b)=>{const at=Date.parse(a.t),bt=Date.parse(b.t);return Number.isFinite(at)&&Number.isFinite(bt)?at-bt:0})
}
