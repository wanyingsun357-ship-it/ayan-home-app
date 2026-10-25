import artwork from '../components/homeArtwork.json'
import {useEffect,useState,useRef} from 'react'
import Home from './Home.jsx'
import WarmTodo from '../components/WarmTodo.jsx'
import {TOGETHER_SINCE,daysSince} from '../config.js'
export default function WarmHome({go,openSidebar,diaryDot}){
 const catTimer=useRef(null); const [petting,setPetting]=useState(false),[cloudTap,setCloudTap]=useState(0)
 useEffect(()=>()=>clearTimeout(catTimer.current),[])
 const petCat=()=>{if(petting)return;setPetting(true);catTimer.current=setTimeout(()=>go("chat"),matchMedia("(prefers-reduced-motion: reduce)").matches?0:700)}
 const [panel,setPanel]=useState(false),[plans,setPlans]=useState([]),[error,setError]=useState(false),[planVersion,setPlanVersion]=useState(0)
 useEffect(()=>{let alive=true;const load=()=>fetch('/api/plans').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(alive){setPlans((d.items||[]).filter(p=>!p.done).sort((a,b)=>String(a.date).localeCompare(String(b.date))));setError(false)}}).catch(()=>{if(alive)setError(true)});load();window.addEventListener('focus',load);return()=>{alive=false;window.removeEventListener('focus',load)}},[panel,planVersion])
 useEffect(()=>{if(!panel)return;const k=e=>{if(e.key==='Escape')setPanel(false)};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[panel])
 return <><main className={`warm-home ${petting?"cat-petting":""}`}><header className="warm-days"><small>DAYS TOGETHER</small><strong>{daysSince(TOGETHER_SINCE)}</strong><time>{new Date().toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}</time></header>
 <button className="warm-todo" onClick={()=>setPanel("todo")}><i>To do <span>···</span></i><small>○　{error?'点开查看待办':plans[0]?.text||'今天想做什么？'}</small>{plans[0]?.date&&<time>{plans[0].date.slice(5).replace('-',' / ')}</time>}</button>
 <button className="warm-today" onClick={()=>setPanel("today")} aria-label="打开 Today 和日历"><span dangerouslySetInnerHTML={{__html:artwork.pendant}}/></button>
 <button key={cloudTap} className={`warm-cloud ${cloudTap?"cloud-tapped":""}`} onClick={()=>setCloudTap(n=>n+1)} aria-label="轻碰云朵"><svg viewBox="0 0 180 112" aria-hidden="true"><path d="M38 21C17 20 5 36 5 57C5 81 27 100 61 101C77 109 99 105 112 101C146 108 176 87 176 65C176 50 167 38 155 34C151 12 130 3 110 4C90 3 76 10 67 20C58 19 47 20 38 21Z"/></svg><span>I'm here.<small>You're back.</small></span></button><i className="warm-thought one"/><i className="warm-thought two"/>
 <button className="warm-cat" onClick={petCat} aria-label="摸摸猫咪，进入 Chat"/>{petting&&<div className="cat-sparkles" aria-hidden="true"><i>✧</i><i>♡</i><i>✦</i><i>♡</i></div>}
 <nav className="warm-dock" aria-label="主页导航">{[['diary','♧','Diary'],['moments','⌘','Moments'],['together','♧','Together'],['more','✧','More']].map(([key,icon,label])=><button key={key} aria-label={label} onClick={()=>go(key)}><span dangerouslySetInnerHTML={{__html:artwork.icons[key]}}/><i>{label}</i>{key==='diary'&&diaryDot&&<b className="warm-diary-dot" aria-label="日记有新动态"/>}</button>)}</nav>
 </main>{panel==='todo'&&<WarmTodo onClose={()=>setPanel(false)} onChange={()=>setPlanVersion(n=>n+1)}/>}{panel==='today'&&<div className="warm-home-panel today" role="dialog" aria-modal="true" aria-label="Today" onClick={()=>setPanel(false)}><section onClick={e=>e.stopPropagation()}><header><button className="detail-close" aria-label="关闭" onClick={()=>setPanel(false)}>×</button><h2>Today</h2></header><Home panelMode="today" go={go} openSidebar={()=>{setPanel(false);openSidebar()}}/></section></div>}</>
}
