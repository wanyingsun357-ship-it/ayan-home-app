export default function CallSoundNote({event}){
 return <div className="call-sound-note" role="note" aria-label="声音提示"><span className="call-sound-label">听到了 ♡</span><span>{event.names.join('、')}</span></div>
}
