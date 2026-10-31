import CallSoundNote from './CallSoundNote.jsx'
import {callTimeline} from '../utils/callSounds.js'
import CallCaption from './CallCaption.jsx'
import {callEntries} from '../utils/callEntries.js'

export default function CallHistory({call,duration,name,onClose,onThought}){
  const entries=callEntries(call.entries),bad=['missed','declined'].includes(call.endedBy)
  const when=new Date(call.startedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
  const how=call.endedBy==='her'?'你挂的':call.endedBy==='him'?'他挂的':call.endedBy==='missed'?(call.by==='him'?'未接来电':'没接通'):(call.by==='him'?'你没接':'他没接')
  return <section className="call call-history" role="dialog" aria-modal="true" aria-label="通话历史"><header className="call-history-head"><button type="button" className="call-min" aria-label="返回聊天" onClick={onClose}><svg viewBox="0 0 24 24"><path d="m14 5-7 7 7 7"/></svg></button><div><h2>{bad?how:`通话 ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}`}</h2><p>{when}{bad?'':` · ${how}`}{entries.length?` · ${entries.length} 句`:''}</p></div><span/></header>
    <div className="call-list call-history-list">{callTimeline(entries,call.sounds||[]).map((entry,i)=>entry.sound?<CallSoundNote key={entry.rowKey} event={entry}/>:<article key={entry.rowKey} className={`call-record ${entry.who}`}><div className="call-history-who"><span>{entry.who==='him'?name:'You'}{entry.via==='text'?' · 打字':''}{entry.late?' · 挂断后':''}</span>{entry.who==='him'&&entry.reasoning&&<button type="button" className="call-history-cloud" aria-label="查看这句话的思考链" onClick={()=>onThought(entry.reasoning)}><svg viewBox="0 0 24 24"><path d="M6 18a4 4 0 0 1-1-7.9A6 6 0 0 1 17 9a4.5 4.5 0 0 1 .5 9Z"/></svg></button>}</div><div className={`call-line ${entry.who}`}>{entry.who==='him'?<CallCaption text={entry.text} zh={entry.zh} compact/>:<span className="call-line-t">{entry.text}</span>}</div></article>)}{!entries.length&&!call.sounds?.length&&<p className="call-history-empty">没说上话</p>}</div>
  </section>
}
