import { useEffect, useRef, useState } from 'react'
import './downloadButton.css'
export const formatBytes = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
export default function DownloadButton({ url, name, size, disabled, className = '' }) {
 const [state,setState]=useState({phase:'idle',loaded:0,total:0}),blobRef=useRef(null),abortRef=useRef(null)
 useEffect(()=>()=>abortRef.current?.abort(),[])
 async function click(e){
  e.stopPropagation()
  if(state.phase==='loading'){abortRef.current?.abort();return}
  if(state.phase==='ready'){
   const blob=blobRef.current;if(!blob)return
   const file=new File([blob],name,{type:blob.type||'application/octet-stream'})
   try{
    if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}
    const a=document.createElement('a'),href=URL.createObjectURL(blob);a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000)
   }catch(err){if(err.name!=='AbortError')setState(s=>({...s,phase:'error'}))}
   return
  }
  const controller=new AbortController();abortRef.current=controller
  setState({phase:'loading',loaded:0,total:0})
  try{
   const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('下载失败')
   const total=size||(!r.headers.get('content-encoding')?Number(r.headers.get('content-length')):0)||0
   const chunks=[];let loaded=0
   if(r.body?.getReader){const reader=r.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;setState({phase:'loading',loaded,total})}}
   else{const b=await r.blob();chunks.push(b);loaded=b.size}
   blobRef.current=new Blob(chunks,{type:r.headers.get('content-type')||'application/octet-stream'});setState({phase:'ready',loaded,total:loaded})
  }catch(err){setState({phase:err.name==='AbortError'?'idle':'error',loaded:0,total:0})}
 }
 const progress=state.phase==='ready'?100:state.total?Math.min(99,Math.floor(state.loaded/state.total*100)):0
 const label=state.phase==='ready'?'保存':state.phase==='loading'?(state.total?`${progress}%`:state.loaded?formatBytes(state.loaded):'准备中'):state.phase==='error'?'重试':'下载'
 return <button type="button" disabled={disabled} className={`download-progress ${className} ${state.phase} ${state.phase==='loading'&&!state.total?'indeterminate':''}`} onClick={click} title={state.phase==='loading'?'点击取消下载':state.phase==='ready'?'文件已取回，点击保存或分享':`下载 ${name}`} aria-label={`${label} ${name}`} style={{'--download-progress':progress+'%'}}><span className="download-progress-fill"/><span className="download-progress-label">{state.phase==='ready'?'✓':'↓'} {label}</span></button>
}
