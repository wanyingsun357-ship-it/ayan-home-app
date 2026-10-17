import { useEffect, useRef, useState } from 'react'
export default function PaperAvatar({who='him',editable=false}) {
 const key='paper-avatar-'+who
 const [src,setSrc]=useState(()=>localStorage.getItem(key)||'')
 const input=useRef(null)
 useEffect(()=>{const refresh=()=>setSrc(localStorage.getItem(key)||'');window.addEventListener('paper-avatar',refresh);return()=>window.removeEventListener('paper-avatar',refresh)},[key])
 async function choose(e){const f=e.target.files?.[0];e.target.value='';if(!f||!f.type.startsWith('image/'))return;const url=URL.createObjectURL(f);try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=c.height=192;const size=Math.min(img.width,img.height);c.getContext('2d').drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,192,192);const data=c.toDataURL('image/jpeg',.85);localStorage.setItem(key,data);window.dispatchEvent(new Event('paper-avatar'))}catch{alert('头像未能保存，请换一张图片重试')}finally{URL.revokeObjectURL(url)}}
 const content=src?<img src={src} alt={who==='him'?'晏白头像':'你的头像'}/>:<span>{who==='him'?'☾':'Y'}</span>
 return editable?<><button className="paper-avatar" title="更换头像（保存在本设备）" aria-label={who==='him'?'更换晏白头像':'更换你的头像'} onClick={()=>input.current?.click()}>{content}</button><input ref={input} hidden type="file" accept="image/*" onChange={choose}/></>:<span className="paper-avatar">{content}</span>
}
