import { useEffect, useState } from 'react'
import './chatCalendar.css'
export default function ChatCalendar({ onPick, busy, session }) {
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1))
 const [days,setDays]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{const c=new AbortController();setDays(null);setError(false);if(!session){setError(true);return()=>c.abort()}
  const q=new URLSearchParams({session,days:'1',tz:Intl.DateTimeFormat().resolvedOptions().timeZone})
  fetch('/api/chat-window?'+q,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.days))throw Error();return d.days}).then(d=>{if(!c.signal.aborted)setDays(new Set(d))}).catch(e=>{if(e.name!=='AbortError')setError(true)})
  return()=>c.abort()
 },[session,retry])
 const year=month.getFullYear(),m=month.getMonth(),offset=month.getDay(),count=new Date(year,m+1,0).getDate()
 const move=n=>setMonth(new Date(year,m+n,1))
 return <section className="chat-calendar glass2" aria-label="聊天日历">
  <header><strong>{month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button aria-label="上个月" onClick={()=>move(-1)}>‹</button><button aria-label="下个月" onClick={()=>move(1)}>›</button></header>
  <div className="chat-calendar-grid">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=><small key={d}>{d}</small>)}{Array.from({length:offset},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:count},(_,i)=>{const day=i+1,date=`${year}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,future=new Date(year,m,day)>new Date();return <button key={date} aria-label={date} disabled={busy||future||!days?.has(date)} onClick={()=>onPick(date)} className={days?.has(date)&&new Date().toDateString()===new Date(year,m,day).toDateString()?'today':''}>{day}</button>})}</div>
  <footer>{error?<button onClick={()=>setRetry(n=>n+1)}>日期暂未取回，点此重试</button>:days===null?'正在查找有聊天的日子…':'灰色日期没有聊天，选一天回到第一条'}</footer>
 </section>
}
