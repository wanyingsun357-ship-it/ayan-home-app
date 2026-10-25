import {useEffect,useRef} from 'react'
export default function WarmSplash({onDone,onReveal}){
 const cb=useRef({onDone,onReveal});cb.current={onDone,onReveal};const done=useRef(false)
 const finish=()=>{if(done.current)return;done.current=true;cb.current.onReveal?.();cb.current.onDone()}
 useEffect(()=>{const reduced=matchMedia('(prefers-reduced-motion: reduce)'),timer=setTimeout(finish,reduced.matches?220:3500),reveal=setTimeout(()=>cb.current.onReveal?.(),reduced.matches?0:3000);const vis=()=>{if(document.hidden)finish()};const key=e=>{if(e.key==='Escape')finish()};document.addEventListener('visibilitychange',vis);window.addEventListener('pagehide',finish);window.addEventListener('keydown',key);return()=>{clearTimeout(timer);clearTimeout(reveal);document.removeEventListener('visibilitychange',vis);window.removeEventListener('pagehide',finish);window.removeEventListener('keydown',key)}},[])
 return <button className="warm-splash" aria-label="跳过开屏，进入主页" onClick={finish}><span className="warm-splash-wash"/><span className="warm-splash-words">I'm here.<small>You're back.</small></span><span className="warm-splash-skip">轻点进入</span></button>
}
