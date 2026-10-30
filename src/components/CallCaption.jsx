import {voiceTranscript} from '../utils/voiceText.js'
export default function CallCaption({text,zh,live=false}){const en=voiceTranscript(text||''),cn=voiceTranscript(zh||'');return <div className="call-caption"><div className="call-caption-primary">{cn||(live?'正在说话…':en)}</div>{en&&(cn||live)&&<details className="call-caption-english"><summary>英文</summary><div>{en}</div></details>}</div>}
