import PixelCat from './PixelCat.jsx'
import {useAppearance} from '../utils/appearance.js'
import '../orange-sprites.css'
import useCompanion from '../utils/useCompanion.js'
import {COMPANION_POSES} from '../utils/companionMessage.js'
export default function WarmCompanion({online=true,busy=false,pose='ai_idle',size=64,live=false,message,sessionId,fault=0}){
 const appearance=useAppearance()
 const state=useCompanion({live:live&&appearance.theme==='orange',online,busy,message,sessionId,fault})
 const sprite=live?(COMPANION_POSES[state]||(state==='error'?'neo_sad':'ai_idle')):(busy?'ai_talk':pose)
 if(appearance.theme!=='orange')return <PixelCat size={size}/>
 return <span data-companion-state={live?state:'preview'} className={`warm-companion sprite-${sprite} ${online?'':'offline'}`} style={{'--sprite-size':size+'px'}} role="img" aria-label={online?(busy?'小螃蟹正在等回复':'小螃蟹'):'连接已断开，小螃蟹休息中'}/>
}
