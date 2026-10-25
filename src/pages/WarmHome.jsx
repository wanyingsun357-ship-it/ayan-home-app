import artwork from '../components/homeArtwork.json'
import {useEffect,useState} from 'react'
import Home from './Home.jsx'
import {TOGETHER_SINCE,daysSince} from '../config.js'
export default function WarmHome({go,openSidebar}){
 const [panel,setPanel]=useState(false),[plans,setPlans]=useState([]),[error,setError]=useState(false)
 useEffect(()=>{let alive=true;fetch('/api/plans').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(alive)setPlans((d.items||[]).filter(p=>p.date===d.today&&!p.done))}).catch(()=>{if(alive)setError(true)});return()=>{alive=false}},[panel])
 useEffect(()=>{if(!panel)return;const k=e=>{if(e.key==='Escape')setPanel(false)};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[panel])
 return <><main className="warm-home"><header className="warm-days"><small>DAYS TOGETHER</small><strong>{daysSince(TOGETHER_SINCE)}</strong><time>{new Date().toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}</time></header>
 <button className="warm-todo" onClick={()=>setPanel(true)}><i>To do <span>···</span></i><small>○　{error?'点开查看待办':plans[0]?.text||'今天想做什么？'}</small></button>
 <button className="warm-today" onClick={()=>setPanel(true)} aria-label="打开 Today 和日历"><span dangerouslySetInnerHTML={{__html:artwork.pendant}}/></button>
 <button className="warm-cloud" onClick={()=>go('chat')} aria-label="进入 Chat"><svg viewBox="0 0 180 112" aria-hidden="true"><path d="M38 21C17 20 5 36 5 57C5 81 27 100 61 101C77 109 99 105 112 101C146 108 176 87 176 65C176 50 167 38 155 34C151 12 130 3 110 4C90 3 76 10 67 20C58 19 47 20 38 21Z"/></svg><span>I'm here.<small>You're back.</small></span></button><i className="warm-thought one"/><i className="warm-thought two"/>
 <button className="warm-cat" onClick={()=>go('chat')} aria-label="摸摸猫咪，进入 Chat"/>
 <nav className="warm-dock" aria-label="主页导航">{[['diary','♧','Diary'],['moments','⌘','Moments'],['together','♧','Together'],['more','✧','More']].map(([key,icon,label])=><button key={key} aria-label={label} onClick={()=>go(key)}><span dangerouslySetInnerHTML={{__html:artwork.icons[key]}}/><i>{label}</i></button>)}</nav>
 </main>{panel&&<div className="warm-today-mask" role="dialog" aria-modal="true" aria-label="Today"><section><button className="warm-today-back" onClick={()=>setPanel(false)}>‹ 返回</button><Home go={go} openSidebar={openSidebar}/></section></div>}</>
}
