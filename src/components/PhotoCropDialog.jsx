import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'

// Store a normalized source rectangle; keep the original photo for later edits.
export default function PhotoCropDialog({photo,ratio=1.8,onSave,onClose}) {
  const W=260,H=W/ratio,drag=useRef(null),cancel=useRef(null)
  const [image,setImage]=useState(null),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0}),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{
    let active=true
    const img=new Image();img.src=photo.src
    img.decode().then(()=>{if(!active)return;setImage(img);const c=photo.crop
      if(c&&Math.abs(c.w*img.naturalWidth/(c.h*img.naturalHeight)-ratio)<.03){
        const fit=Math.max(W/img.naturalWidth,H/img.naturalHeight),s=W/(c.w*img.naturalWidth)
        setZoom(Math.max(1,Math.min(3,s/fit)));setOffset({x:(.5-c.x-c.w/2)*img.naturalWidth*s,y:(.5-c.y-c.h/2)*img.naturalHeight*s})
      }
    }).catch(()=>active&&setError('照片未能打开，请重新选择'))
    cancel.current?.focus();const escape=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',escape)
    return()=>{active=false;window.removeEventListener('keydown',escape)}
  },[photo.id,photo.src,ratio])
  const scale=image?Math.max(W/image.naturalWidth,H/image.naturalHeight)*zoom:1
  const bounded=(point,z=zoom)=>{if(!image)return point;const s=Math.max(W/image.naturalWidth,H/image.naturalHeight)*z,x=(image.naturalWidth*s-W)/2,y=(image.naturalHeight*s-H)/2;return{x:Math.max(-x,Math.min(x,point.x)),y:Math.max(-y,Math.min(y,point.y))}}
  const save=async()=>{if(!image||busy)return;setBusy(true);try{await onSave({sourceAspect:image.naturalWidth/image.naturalHeight,x:(image.naturalWidth-W/scale)/2/image.naturalWidth-offset.x/scale/image.naturalWidth,y:(image.naturalHeight-H/scale)/2/image.naturalHeight-offset.y/scale/image.naturalHeight,w:W/scale/image.naturalWidth,h:H/scale/image.naturalHeight})}catch{setError('未能保存，裁剪预览仍保留')}finally{setBusy(false)}}
  return createPortal(<div className="photo-crop-mask" onClick={()=>!busy&&onClose()}><section className="photo-crop-dialog" role="dialog" aria-modal="true" aria-label="裁剪照片" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key!=='Tab')return;const items=[...e.currentTarget.querySelectorAll('button:not(:disabled),input')],i=items.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();items.at(-1)?.focus()}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0]?.focus()}}}>
    <h2>裁剪照片</h2><p>拖动和缩放，预览这张照片的位置</p>
    <div className="photo-crop-stage" style={{width:W,height:H}} onPointerDown={e=>{if(drag.current||!image)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,offset}}} onPointerMove={e=>{const d=drag.current;if(d&&d.id===e.pointerId)setOffset(bounded({x:d.offset.x+e.clientX-d.x,y:d.offset.y+e.clientY-d.y}))}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} onLostPointerCapture={()=>drag.current=null}>
      {image&&<img src={photo.src} alt="照片裁剪预览" draggable="false" style={{width:image.naturalWidth*scale,height:image.naturalHeight*scale,transform:`translate(calc(-50% + ${offset.x}px),calc(-50% + ${offset.y}px))`}}/>}<span/>
    </div><label>缩放<input type="range" aria-label="照片缩放" min="1" max="3" step=".01" value={zoom} onChange={e=>{const z=Number(e.target.value);setZoom(z);setOffset(bounded(offset,z))}}/></label>
    {error&&<p role="alert">{error}</p>}<footer><button ref={cancel} disabled={busy} onClick={onClose}>取消</button><button disabled={busy} onClick={()=>{setZoom(1);setOffset({x:0,y:0})}}>重置</button><button disabled={!image||busy} onClick={save}>使用裁剪</button></footer>
  </section></div>,document.body)
}
