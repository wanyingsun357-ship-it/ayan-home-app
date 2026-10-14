import { useEffect, useState } from 'react'
import DownloadButton, { formatBytes } from './DownloadButton.jsx'
export default function ArtifactsSheet({ session, onClose, onOpen }) {
 const [items,setItems]=useState([]),[status,setStatus]=useState('正在读取…'),[retry,setRetry]=useState(0)
 useEffect(()=>{const c=new AbortController();setItems([]);setStatus('正在读取…');fetch('/api/home-files?session='+encodeURIComponent(session),{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{setItems(d.items||[]);setStatus('')}).catch(e=>{if(e.name!=='AbortError')setStatus('文件暂未取回，点击重试')});return()=>c.abort()},[session,retry])
 return <div className="sheet-mask" onClick={onClose}><div className="sheet thought artifacts-sheet" role="dialog" aria-label="Artifacts" onClick={e=>e.stopPropagation()}>
  <div className="sheet-handle"/><div className="thought-head"><button className="thought-x" onClick={onClose}>×</button><div className="thought-title">Artifacts</div><div style={{width:34}}/></div>
  <div className="up-list">{status?<button className="artifacts-status" onClick={()=>setRetry(n=>n+1)}>{status}</button>:!items.length?<div className="up-empty">这个家还没有文件</div>:items.map(f=><div className="up-item" key={f.key}>
   <button className="artifact-open" disabled={f.missing} onClick={()=>onOpen(f)}><span className="up-icon">{['HTML','HTM'].includes(f.ext)?'🌐':'📄'}</span><span className="up-info"><span className="up-name">{f.title}</span><span className="up-meta">{f.ext} · {f.missing?'文件已不在原位置':formatBytes(f.size)} · {f.source==='made'?'Made':'Sent'}</span></span></button>
   <DownloadButton url={f.url} name={f.name} size={f.size} disabled={f.missing}/>
  </div>)}</div>
 </div></div>
}
