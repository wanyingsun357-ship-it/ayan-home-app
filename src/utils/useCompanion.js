import {useEffect,useRef,useState} from 'react'
import {companionReaction} from './companionMessage.js'

export default function useCompanion({live,online,busy,message,sessionId,fault=0}){
 const [state,setState]=useState('idle'),latest=useRef(message),wasBusy=useRef(false),startMessage=useRef(null),startedAt=useRef(0),seenFault=useRef(fault)
 latest.current=message
 useEffect(()=>{wasBusy.current=false;startMessage.current=null;seenFault.current=fault;setState('idle')},[sessionId,live])
 useEffect(()=>{
  if(!live)return
  if(!online){wasBusy.current=false;seenFault.current=fault;setState('idle');return}
  if(fault!==seenFault.current){seenFault.current=fault;wasBusy.current=false;setState('error');return}
  if(busy){if(!wasBusy.current){startMessage.current=latest.current?.streaming?null:(latest.current?.absIdx??latest.current?.id);startedAt.current=Date.now()}wasBusy.current=true;setState('thinking');return}
  if(wasBusy.current){
   wasBusy.current=false
   const m=latest.current
   if(m?.role==='assistant'&&(m.absIdx??m.id)!==startMessage.current&&m.timeMs>=startedAt.current-1000)setState(companionReaction(m.content));else setState('idle')
  }
 },[live,online,busy,fault,sessionId])
 useEffect(()=>{
  if(!live||!online||busy||state!=='idle'||matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const wait=45000+Math.random()*45000
  const start=setTimeout(()=>{if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const poses=['look','reading','listening','doze','toast','surf','confused'];setState(poses[Math.floor(Math.random()*poses.length)])},wait)
  return()=>clearTimeout(start)
 },[live,online,busy,state,sessionId])
 useEffect(()=>{
  if(!live||busy||state==='idle')return
  const id=setTimeout(()=>setState('idle'),6500);return()=>clearTimeout(id)
 },[live,busy,state,sessionId])
 return !online?'offline':state
}
