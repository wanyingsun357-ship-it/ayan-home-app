// Identity comes from the server entry, never from its wording: saying the same
// sentence on two different turns must still produce two messages.
export function callEntries(entries=[]){
  const seen=new Set()
  return entries.filter(e=>{if(!e.t)return true;const key=e.who+'|'+e.t;if(seen.has(key))return false;seen.add(key);return true})
}
export function appendCallEntry(history,entry){
  if(entry.t&&history.some(e=>e.who===entry.who&&e.t===entry.t))return history
  return [...history,entry]
}
