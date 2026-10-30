import {Capacitor,registerPlugin} from '@capacitor/core'

const plugin=registerPlugin('NativeCalls')
export const nativeCalls={
  supported:()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('NativeCalls'),
  async present(id){
    if(!this.supported())return false
    const response=await fetch(`/api/native-call/credentials?id=${encodeURIComponent(id)}`)
    if(!response.ok)return false
    const data=await response.json()
    const result=await plugin.present({native:data.native})
    return result.supported===true
  },
  async startOutgoing(id){
    if(!this.supported())return false
    const response=await fetch('/api/native-call/credentials?id='+encodeURIComponent(id)+'&direction=outgoing')
    if(!response.ok)return false
    const data=await response.json()
    const result=await plugin.startOutgoing({native:data.native,call:data.call})
    return result.supported===true&&result.mediaOwned===true
  },
  answer:()=>plugin.answer(),
  end:()=>plugin.end(),
  muted:(muted)=>plugin.setMuted({muted}),
  speaker:(on)=>plugin.setSpeaker({on}),
  state:()=>plugin.getState(),
}

export async function setupNativeCalls(onEvent){
  if(!nativeCalls.supported())return()=>{}
  let stopped=false,latest=null
  const register=async(state)=>{
    if(stopped||!state?.supported||!state.token)return
    latest=state
    await fetch('/api/native-call/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:state.deviceId,token:state.token,environment:state.environment,apnsToken:localStorage.getItem('ayan-apns-token')||undefined})}).catch(()=>{})
  }
  const handle=await plugin.addListener('event',event=>{
    if(event.type==='token')register(event)
    if(!stopped)onEvent(event)
  })
  const state=await plugin.configure();await register(state);if(!stopped)onEvent({...state,type:'state'})
  const resume=()=>{if(!document.hidden){plugin.getState().then(s=>{register(s);if(!stopped)onEvent({...s,type:'state'})}).catch(()=>{})}}
  const apns=()=>{if(latest)register(latest)}
  document.addEventListener('visibilitychange',resume);window.addEventListener('ayan:apns-token',apns)
  return()=>{stopped=true;handle.remove();document.removeEventListener('visibilitychange',resume);window.removeEventListener('ayan:apns-token',apns)}
}
