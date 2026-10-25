import {useEffect,useState} from 'react'
import PixelCat from './PixelCat.jsx'
import {useAppearance} from '../utils/appearance.js'
import '../orange-sprites.css'
export default function WarmCompanion({online=true,busy=false,pose='ai_idle',size=64}){
 const appearance=useAppearance(),[idle,setIdle]=useState(pose)
 useEffect(()=>{setIdle(pose);if(matchMedia('(prefers-reduced-motion: reduce)').matches||!online||busy)return;const id=setInterval(()=>setIdle(v=>v===pose?'ai_look':pose),65000);return()=>clearInterval(id)},[pose,online,busy])
 if(appearance.theme!=='orange')return <PixelCat size={size}/>
 return <span className={`warm-companion sprite-${busy?'neo_type_kb':idle} ${online?'':'offline'}`} style={{'--sprite-size':size+'px'}} role="img" aria-label={online?(busy?'小螃蟹正在等回复':'小螃蟹'):'连接已断开，小螃蟹休息中'}/>
}
