import {useEffect,useRef,useState} from 'react'
export default function useHouseDraft(session){
 const [value,update]=useState(''),current=useRef(null),latest=useRef('')
 useEffect(()=>{
  if(!session||session===current.current)return
  const initial=current.current===null?latest.current:''
  current.current=session
  let saved=initial
  try{saved=localStorage.getItem('house-draft:'+session)??initial}catch{}
  latest.current=saved;update(saved)
 },[session])
 const setValue=next=>{
  const text=typeof next==='function'?next(latest.current):next
  latest.current=text;update(text)
  if(current.current)try{if(text)localStorage.setItem('house-draft:'+current.current,text);else localStorage.removeItem('house-draft:'+current.current)}catch{}
 }
 return [value,setValue]
}
