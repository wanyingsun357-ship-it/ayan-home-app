export default function CallSoundNote({event}){
 return <div className="call-sound-note" role="note" aria-label="声音提示"><span className="call-sound-label">听到了 ♡</span><span>{event.names.join('、')}{event.text?.includes('还在继续')?'，还在继续':''}</span>{event.description&&<small>{event.description}</small>}{event.clipFailed&&<small>片段未保存，声音提示已送达</small>}</div>
}
