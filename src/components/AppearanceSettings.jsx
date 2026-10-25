import {useState} from 'react'
import {useAppearance,appearanceChange,resetAppearanceArea} from '../utils/appearance.js'
export default function AppearanceSettings(){
 const state=useAppearance(),[area,setArea]=useState('chat'),profile=state.profiles[state.theme],value=profile.areas[area]
 const set=(key,v)=>appearanceChange(s=>{s.profiles[s.theme].areas[area][key]=v;return s})
 return <div className="set-group warm-appearance"><div className="set-group-name">外观</div>
 <div className="set-row"><span>界面</span><div className="set-seg">{[['original','原版'],['orange','暖橘玻璃']].map(([v,label])=><button key={v} className={state.theme===v?'on':''} aria-pressed={state.theme===v} onClick={()=>appearanceChange(s=>({...s,theme:v}))}>{label}</button>)}</div></div>
 <div className="set-row"><span>光线</span><div className="set-seg">{[['day','日间'],['night','夜间']].map(([v,label])=><button key={v} className={profile.mode===v?'on':''} onClick={()=>appearanceChange(s=>{s.profiles[s.theme].mode=v;return s})}>{label}</button>)}</div></div>
 <label className="set-row">调整页面<select value={area} onChange={e=>setArea(e.target.value)}>{[['home','首页'],['chat','Chat'],['footprints','Footprints'],['memory','Memory']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
 <div className="warm-glass-sample"><div aria-hidden="true" className="warm-sample-bg" style={{opacity:value.strength/100,filter:`blur(${value.backgroundBlur}px)`}}/><span style={{background:`rgb(128 75 36 / ${1-value.transparency*.009})`,backdropFilter:`blur(${value.glassBlur}px)`,WebkitBackdropFilter:`blur(${value.glassBlur}px)`}}>I'm here.<small>You're back.</small></span></div>
 {[['strength','背景强度',100,'%'],['backgroundBlur','背景模糊',32,'px'],['transparency','玻璃透明度',100,'%'],['glassBlur','玻璃模糊',32,'px']].map(([key,label,max,unit])=><label className="set-row set-slider-row" key={key}><span>{label}<small> {value[key]}{unit}</small></span><input aria-label={label} type="range" min="0" max={max} value={value[key]} onChange={e=>set(key,+e.target.value)}/></label>)}
 <div className="set-row"><small>两套界面、各页面分别记住设置</small><button onClick={()=>resetAppearanceArea(area)}>恢复此页默认</button></div></div>
}
