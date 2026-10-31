export function mergeCallSounds(current=[],incoming=[]){
 const byId=new Map()
 for(const event of [...current,...incoming])if(event&&typeof event.id==='string'&&Array.isArray(event.names)&&event.names.length)byId.set(event.id,event)
 return [...byId.values()].slice(-100)
}
export function callTimeline(entries=[],sounds=[]){
 const rows=[...entries.map((entry,i)=>({...entry,rowKey:`${entry.who}|${entry.t||i}`})),...mergeCallSounds([],sounds).map(sound=>({...sound,sound:true,rowKey:'sound|'+sound.id}))]
 rows.sort((a,b)=>{const at=Date.parse(a.t),bt=Date.parse(b.t);return Number.isFinite(at)&&Number.isFinite(bt)?at-bt:0})
 const grouped=[]
 for(const row of rows){
  const last=grouped.at(-1)
  const join=!row.sound&&row.who==='him'&&row.turnId&&last?.who==='him'&&!last.sound&&last.turnId===row.turnId&&(last.segmentCount||1)<3&&((last.zh||'').length+(row.zh||'').length<=90)&&String(last.text||'').length+String(row.text||'').length<=260
  if(join){
   last.text=[last.text,row.text].filter(Boolean).join(' ');last.zh=[last.zh,row.zh].filter(Boolean).join(' ')
   last.segmentCount=(last.segmentCount||1)+1
   last.reasoning=[...new Set([last.reasoning,row.reasoning].filter(Boolean))].join('\n\n')
  }else grouped.push({...row,segmentCount:1})
 }
 return grouped
}
