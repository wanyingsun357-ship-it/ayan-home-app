import {useEffect,useState} from 'react'
import {NAMES} from '../config.js'
export const LOOK_KEY='ins-chat-look-v1'
export function readLooks(){try{return JSON.parse(localStorage.getItem(LOOK_KEY)||'{}')}catch{return {}}}
export function useLooks(){const [looks,set]=useState(readLooks);useEffect(()=>{const update=()=>set(readLooks());window.addEventListener('chat-look',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('chat-look',update);window.removeEventListener('storage',update)}},[]);return looks}
export function saveLook(id,value){const looks=readLooks();looks[id]=value;localStorage.setItem(LOOK_KEY,JSON.stringify(looks));window.dispatchEvent(new Event('chat-look'))}
export function useCallName(session){const looks=useLooks();return looks[session||localStorage.getItem('ins-active-chat')]?.name||NAMES.me}

export const COLOR_FIELDS=[['sent','我的气泡'],['sent-text','我的文字'],['received','他的气泡'],['received-text','他的文字'],['tag','标签填充'],['tag-text','标签文字'],['time','日期与时间'],['text','名字与正文'],['subtitle','顶部短句'],['header-text','天空文字'],['icon','工具图标'],['input','输入框'],['placeholder','输入提示'],['surface','底色'],['secondary','辅助文字'],['muted','次要提示'],['quote','引用填充'],['quote-line','引用竖线'],['border','边框'],['voice','语音图标'],['wave','语音波形'],['heart','爱心'],['accent','强调文字']]
export function colorStyle(colors={}){return Object.fromEntries(COLOR_FIELDS.filter(([k])=>/^#[0-9a-f]{6}$/i.test(colors[k]||'')).map(([k])=>['--lavender-'+k,colors[k]]))}
