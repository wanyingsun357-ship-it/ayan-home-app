import {useEffect,useState} from 'react'

// UI timers sleep in the background; audio and incoming-call delivery stay independent.
export default function usePageVisible(){
 const [visible,setVisible]=useState(()=>!document.hidden)
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update)},[])
 return visible
}
