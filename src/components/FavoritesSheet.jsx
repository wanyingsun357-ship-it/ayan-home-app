import {useEffect,useState} from 'react'
export default function FavoritesSheet({session,onClose,onJump}){
 const [items,setItems]=useState([]),[status,setStatus]=useState('正在读取…')
 const load=async()=>{try{const r=await fetch('/api/chat-favorites?session='+encodeURIComponent(session));if(!r.ok)throw Error();setItems((await r.json()).items);setStatus('')}catch{setStatus('暂时读不到，点击重试')}}
 useEffect(()=>{load()},[session])
 const remove=async id=>{try{const r=await fetch('/api/chat-favorites/'+id,{method:'DELETE'});if(!r.ok)throw Error();setItems(xs=>xs.filter(x=>x.id!==id))}catch{setStatus('移除失败，点击重试')}}
 return <div className="sheet-mask" onClick={onClose}><div className="sheet thought artifacts-sheet" role="dialog" aria-label="Favorites" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="thought-head"><button className="thought-x" onClick={onClose}>×</button><div className="thought-title">Favorites</div><div style={{width:34}}/></div><div className="up-list">{status?<button className="artifacts-status" onClick={load}>{status}</button>:!items.length?<div className="up-empty">长按聊天里的一句话，把它收藏在这里。</div>:items.map(f=><article className="favorite-card up-item" key={f.id}><div className="favorite-copy">{f.content}</div><div className="favorite-actions"><small>{f.timestamp?new Date(f.timestamp).toLocaleDateString():''}</small><button disabled={f.index<0} onClick={()=>onJump(f.index)}>{f.index<0?'原消息已改变或删除':'回到聊天'}</button><button onClick={()=>remove(f.id)}>移除</button></div></article>)}</div></div></div>
}
