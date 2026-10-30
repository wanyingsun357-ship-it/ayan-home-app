import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
export const MOMENTS_BACKGROUND_KEY = 'vera-moments-background-v1'
export function readMomentsBackground() {
  try { const value = localStorage.getItem(MOMENTS_BACKGROUND_KEY) || ''; return /^data:image\/jpeg;base64,/.test(value) ? value : '' } catch { return '' }
}
const W = 240, H = 340
export default function MomentsBackgroundPicker({ value, onChange }) {
  const [crop,setCrop] = useState(null), [zoom,setZoom] = useState(1), [offset,setOffset] = useState({x:0,y:0}), [error,setError] = useState('')
  const file=useRef(null), trigger=useRef(null), cancel=useRef(null), drag=useRef(null), request=useRef(0)
  useEffect(()=>()=>{request.current++},[])
  useEffect(()=>{
    if(!crop)return
    cancel.current?.focus()
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();setCrop(null);trigger.current?.focus()}}
    window.addEventListener('keydown',escape)
    return()=>{URL.revokeObjectURL(crop.url);window.removeEventListener('keydown',escape)}
  },[crop])
  const scale=crop?Math.max(W/crop.img.naturalWidth,H/crop.img.naturalHeight)*zoom:1
  const bound=(point,z=zoom)=>{
    if(!crop)return point
    const s=Math.max(W/crop.img.naturalWidth,H/crop.img.naturalHeight)*z
    const x=(crop.img.naturalWidth*s-W)/2,y=(crop.img.naturalHeight*s-H)/2
    return {x:Math.max(-x,Math.min(x,point.x)),y:Math.max(-y,Math.min(y,point.y))}
  }
  const close=()=>{setCrop(null);setError('');trigger.current?.focus()}
  async function choose(e){
    const selected=e.target.files?.[0];e.target.value='';setError('')
    if(!selected)return
    if(!selected.type.startsWith('image/')){setError('请选择一张图片');return}
    if(selected.size>30*1024*1024){setError('图片请小于30MB');return}
    const ticket=++request.current,url=URL.createObjectURL(selected)
    try{const img=new Image();img.src=url;await img.decode();if(ticket!==request.current){URL.revokeObjectURL(url);return}setZoom(1);setOffset({x:0,y:0});setCrop({url,img})}
    catch{URL.revokeObjectURL(url);if(ticket===request.current)setError('图片未能打开，请换一张重试')}
  }
  function save(){
    try{const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1275
      canvas.getContext('2d').drawImage(crop.img,(crop.img.naturalWidth-W/scale)/2-offset.x/scale,(crop.img.naturalHeight-H/scale)/2-offset.y/scale,W/scale,H/scale,0,0,900,1275)
      const data=canvas.toDataURL('image/jpeg',.88);localStorage.setItem(MOMENTS_BACKGROUND_KEY,data);onChange(data);close()
    }catch{setError('背景未能保存，请尝试小一点的图片')}
  }
  function restore(){try{localStorage.removeItem(MOMENTS_BACKGROUND_KEY);onChange('');setError('')}catch{setError('暂时未能恢复，请再试一次')}}
  return <>
    <div className="vera-background-controls"><button ref={trigger} type="button" onClick={()=>file.current?.click()} aria-label="上传裁剪动态背景"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="16" cy="8" r="1.5"/><path d="m3 17 6-6 5 5 3-3 4 4"/></svg><span>背景</span></button>{value&&<button type="button" onClick={restore}>恢复斜纹</button>}</div>
    <input ref={file} hidden type="file" accept="image/*" onChange={choose}/>
    {error&&!crop&&<p className="vera-background-error" role="alert">{error}</p>}
    {crop&&createPortal(<div className="vera-background-mask" onClick={close}><section className="vera-background-dialog" role="dialog" aria-modal="true" aria-labelledby="vera-background-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key!=='Tab')return;const items=[...e.currentTarget.querySelectorAll('button,input')],i=items.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0].focus()}}}>
      <h2 id="vera-background-title">裁剪背景</h2><p>拖动与缩放，选择画面的位置</p>
      <div className="vera-background-stage" onPointerDown={e=>{if(drag.current)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,offset}}} onPointerMove={e=>{const d=drag.current;if(d&&d.id===e.pointerId)setOffset(bound({x:d.offset.x+e.clientX-d.x,y:d.offset.y+e.clientY-d.y}))}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} onLostPointerCapture={()=>drag.current=null}>
        <img src={crop.url} alt="动态背景裁剪预览" draggable="false" style={{width:crop.img.naturalWidth*scale,height:crop.img.naturalHeight*scale,transform:`translate(calc(-50% + ${offset.x}px),calc(-50% + ${offset.y}px))`}}/><span className="vera-background-grid"/>
      </div><label className="vera-background-zoom">缩放<input type="range" aria-label="背景缩放" min="1" max="3" step=".01" value={zoom} onChange={e=>{const z=Number(e.target.value);setZoom(z);setOffset(bound(offset,z))}}/></label>
      {error&&<p role="alert">{error}</p>}<div className="vera-background-actions"><button ref={cancel} onClick={close}>取消</button><button onClick={()=>{setZoom(1);setOffset({x:0,y:0})}}>重置</button><button className="save" onClick={save}>使用背景</button></div>
    </section></div>,document.body)}
  </>
}
