import { useEffect, useState } from 'react'
const KEY = 'ayan-appearance-v1'
const areas = ['home','chat','footprints','memory']
const clamp = (v,min,max,fallback) => Number.isFinite(Number(v)) ? Math.min(max,Math.max(min,Number(v))) : fallback
const read = key => { try { return localStorage.getItem(key) } catch { return null } }
function defaults(theme) {
  return { mode: read('theme') || 'day', areas: Object.fromEntries(areas.map(area=>[area,{
    strength: theme==='original' ? 100-clamp(read('bg-dim')||0,0,.4,0)*100 : 100,
    backgroundBlur: area==='home'?0:area==='chat'?7:18,
    transparency: theme==='original'?Math.round(100-clamp(read('glass-k')||1,.75,1.35,1)*40):70,
    glassBlur:16
  }])) }
}
function load() {
  let saved;try{saved=JSON.parse(read(KEY)||'null')}catch{}
  const state={theme:(saved?.theme||read('visual-theme'))==='original'?'original':'orange',profiles:{}}
  for(const theme of ['original','orange']){
    const def=defaults(theme),src=saved?.profiles?.[theme];
    state.profiles[theme]={mode:src?.mode==='night'?'night':src?.mode==='day'?'day':def.mode,areas:{}}
    for(const area of areas){const d=def.areas[area],s=src?.areas?.[area]||{};state.profiles[theme].areas[area]={strength:clamp(s.strength,0,100,d.strength),backgroundBlur:clamp(s.backgroundBlur,0,32,d.backgroundBlur),transparency:clamp(s.transparency,0,100,d.transparency),glassBlur:clamp(s.glassBlur,0,32,d.glassBlur)}}
  }
  return state
}
let state=load()
export function applyAppearance(view=document.documentElement.dataset.view||'home') {
  const root=document.documentElement,p=state.profiles[state.theme],area=view==='shopping'?'footprints':areas.includes(view)?view:'home',a=p.areas[area]
  root.dataset.visual=state.theme;root.dataset.theme=p.mode;root.dataset.view=view
  root.style.setProperty('--warm-strength',a.strength/100)
  root.style.setProperty('--warm-bg-blur',a.backgroundBlur+'px')
  root.style.setProperty('--warm-glass-alpha',1-a.transparency*.009)
  root.style.setProperty('--warm-glass-blur',a.glassBlur+'px')
  root.style.setProperty('--bg-dim',(100-a.strength)/100)
  root.style.setProperty('--gk',(100-a.transparency)/40)
}
export function appearanceChange(fn){state=fn(structuredClone(state));try{localStorage.setItem(KEY,JSON.stringify(state));localStorage.setItem('visual-theme',state.theme);localStorage.setItem('theme',state.profiles[state.theme].mode)}catch{}applyAppearance();window.dispatchEvent(new Event('appearance-change'))}
export function useAppearance(){const [value,setValue]=useState(state);useEffect(()=>{const update=()=>setValue(state);window.addEventListener('appearance-change',update);return()=>window.removeEventListener('appearance-change',update)},[]);return value}
export function resetAppearanceArea(area){appearanceChange(s=>{s.profiles[s.theme].areas[area]=defaults(s.theme).areas[area];return s})}
applyAppearance()
