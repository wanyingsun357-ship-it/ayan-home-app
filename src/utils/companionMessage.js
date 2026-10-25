// Assistant-only presentation metadata. It never represents a real tool or presence.
export const COMPANION_POSES = {
 idle:'ai_idle', look:'ai_look', wave:'ai_wave', reading:'ai_read', thinking:'ai_talk',
 coding:'neo_type_kb', terminal:'neo_bash', testing:'neo_bash_test', search:'neo_search',
 love:'neo_shy', happy:'neo_happy', celebrate:'neo_done', listening:'neo_listen',
 doze:'neo_sleep_bubble', sleepy:'neo_sleep_cap', painting:'neo_paint', toast:'neo_toast',
 surf:'neo_surf', confused:'neo_confused',
}
const aliases={joy:'happy',heart:'love',kiss:'love',shy:'love',code:'coding',calm:'idle'}
export function companionPose(name){const n=String(name||'').toLowerCase();return Object.hasOwn(COMPANION_POSES,n)?n:Object.hasOwn(aliases,n)?aliases[n]:null}

export function parseCompanionMessage(content='',streaming=false){
 let fence=null,control=null,inVoice=false,inTouch=false;const visible=[]
 const lines=String(content).split('\n')
 lines.forEach((line,i)=>{
  const marker=line.match(/^\s{0,3}(`{3,}|~{3,})/)
  if(marker){if(!fence)fence={char:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.char&&marker[1].length>=fence.length)fence=null;visible.push(line);return}
  if(line.includes('[VOICE]'))inVoice=true
  if(/\[TOUCH:/.test(line))inTouch=true
  if(!fence&&!inVoice&&!inTouch){
   const tag=line.match(/^\s{0,3}<clawd\s+anim=["']([a-z-]+)["']\s*(?:\/\s*>|>\s*<\/clawd>)\s*$/i)
   if(tag){control=companionPose(tag[1])||control;return}
   const tail=line.trimStart()
   if(streaming&&i===lines.length-1&&tail.startsWith('<')&&('<clawd'.startsWith(tail.toLowerCase())||/^<clawd(?:\s|$)/i.test(tail)))return
  }
  visible.push(line)
  if(line.includes('[/VOICE]'))inVoice=false
  if(line.includes('[/TOUCH]'))inTouch=false
 })
 return {text:visible.join('\n').trimEnd(),control}
}
export const displayMessage = m => m?.role==='assistant'?parseCompanionMessage(m.content,!!m.streaming).text:String(m?.content||'')
export function companionReaction(content=''){
 const parsed=parseCompanionMessage(content)
 if(parsed.control)return parsed.control
 let prose=parsed.text.slice(0,100000).replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g,'').replace(/`[^`]*`/g,'').replace(/^\s*>.*$/gm,'')
 prose=prose.replace(/[“「『][\s\S]*?[”」』]|"[^"\n]*"/g,'')
 if(/\[TOUCH:[a-z]+[^\]]*\][\s\S]*?\[\/TOUCH\]/.test(prose))return 'love'
 const clauses=prose.split(/[。！？!?\n；;]/).filter(s=>!/(?:不|没|别|勿|无|无法|不能|不要|如果|假如|比如|例如|示例|关键词|这个词|意思是|他说|她说)|\b(?:not|never|don't|doesn't|didn't|can't|cannot|without|if|example)\b/i.test(s)).join('。')
 if(/亲亲|亲你|亲一[下口]|啵啵|么么|\bkiss(?:es)?\b|😘|😚|爱你|爱着你|喜欢你|想你了|抱抱|抱住你|\blove you\b|❤️|💕|💗/i.test(clauses))return 'love'
 if(/难过|不开心|伤心|低落|累了|难受/.test(prose))return 'idle'
 return 'happy'
}
