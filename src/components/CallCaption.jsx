import {useId,useState} from 'react'
import {voiceTranscript} from '../utils/voiceText.js'
export default function CallCaption({text,zh,live=false,compact=false}){
  const en=voiceTranscript(text||''),cn=voiceTranscript(zh||''),[expanded,setExpanded]=useState(false),id=useId()
  if(!compact)return <div className="call-caption"><div className="call-caption-primary">{cn||(live?'正在说话…':en)}</div>{en&&(cn||live)&&<details className="call-caption-english"><summary>英文</summary><div>{en}</div></details>}</div>
  return <div className="call-caption compact"><div className="call-caption-primary"><span>{cn||(live?'正在说话…':en)}</span>{en&&cn&&<button type="button" className="call-translation-toggle" aria-label={expanded?'收起英文':'展开英文'} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(x=>!x)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={expanded?'m5 12 5-5 5 5':'m5 8 5 5 5-5'}/></svg></button>}</div>{en&&cn&&expanded&&<div id={id} className="call-caption-translation" lang="en">{en}</div>}</div>
}
