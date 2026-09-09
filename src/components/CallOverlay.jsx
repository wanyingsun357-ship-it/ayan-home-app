import { useEffect, useRef, useState } from 'react'
import PixelCat from './PixelCat.jsx'
import { createAsrStream, getWarmSocket } from '../utils/asrStream.js'
import { NAMES } from '../config.js'
import { isApp, callAudio } from '../utils/native.js'
import './call.css'

// 通话(一期):她打过去 → 响铃 → 他 [ANSWER]/[DECLINE] → 通话中:
//   她说:流式识别,一句定稿后静音 1 秒算说完 → /api/call/say
//   他答:英文字幕大字 + 中文小字,ElevenLabs 流式放;放的时候麦克风静音(防回声,一期不做打断)
//   挂断:她按红钮 / 他 [HANGUP] 放完这句 → 聊天里落通话卡
// 界面:正在说的那句大字居中,说完往上推变小变淡;上滑看完整记录;只有说完的才标 You / 晏白
const fmt = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
const SILENT = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const Ic = {
  mic: <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>,
  micOff: <svg viewBox="0 0 24 24"><path d="M9 9v5a3 3 0 0 0 5.1 2.1M15 9.5V6a3 3 0 0 0-6 0v1M5 11a7 7 0 0 0 11.6 5.2M19 11a7 7 0 0 1-.7 3M12 18v3M9 21h6M4 4l16 16" /></svg>,
  pen: <svg viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3" /></svg>,
  spk: <svg viewBox="0 0 24 24"><path d="M4 10v4h3l4 3V7l-4 3H4zM15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" /></svg>,
  spkOff: <svg viewBox="0 0 24 24"><path d="M4 10v4h3l4 3V7l-4 3H4zM16 10l4 4M20 10l-4 4" /></svg>,
  phone: <svg viewBox="0 0 24 24"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>,
}
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })

export default function CallOverlay() {
  const [call, setCall] = useState(null)          // 服务器视角的通话
  const [phase, setPhase] = useState('idle')      // idle | ringing | active | ended
  const [min, setMin] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [live, setLive] = useState('')            // 她正在说的(流式)
  const [speaking, setSpeaking] = useState(null)  // 他正在说的 {text, zh}
  const [history, setHistory] = useState([])      // 说完的 [{who,text,zh}]
  const [muted, setMuted] = useState(false)
  const [quiet, setQuiet] = useState(false)       // 网页版的"免提"位:切不了听筒,只能=不放他的声音只看字幕
  const [speaker, setSpeaker] = useState(false)   // App 里的真免提:听筒 ↔ 扬声器
  const speakerRef = useRef(false); speakerRef.current = speaker
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [endInfo, setEndInfo] = useState('')
  const [needTap, setNeedTap] = useState(false)   // 刷新后恢复通话:麦克风要一次点击
  const [toast, setToast] = useState('')

  const ctxRef = useRef(null), streamRef = useRef(null), asrRef = useRef(null), audioRef = useRef(null), srcRef = useRef(null)
  const callRef = useRef(null); callRef.current = call
  const phaseRef = useRef('idle'); phaseRef.current = phase
  const quietRef = useRef(false); quietRef.current = quiet
  const mutedRef = useRef(false); mutedRef.current = muted
  const typingRef = useRef(false); typingRef.current = typing
  const bufRef = useRef([]); const bufTimer = useRef(null)
  const finalLenRef = useRef(0)   // 整通电话里已定稿的字数(阿里的 all 是累计的)
  const sayQueue = useRef([]); const busyRef = useRef(false)
  const playQueue = useRef([]); const playingRef = useRef(false)
  const turnRef = useRef(null)   // 当前这轮:{ played:[], zh }
  const nowSegRef = useRef('')   // 正在念的那句(流式)
  const offsetRef = useRef(0)
  const listRef = useRef(null)
  const ringTimer = useRef(null)
  const reconnRef = useRef(0)      // 通话里识别通道自动重连次数
  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 2200) }

  // ---- 时钟 & 自动滚到底 ----
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [history, live, speaking])

  // ---- 事件:Chat 顶栏的电话键 ----
  useEffect(() => {
    const onStart = (e) => start(e.detail || {})
    window.addEventListener('call:start', onStart)
    return () => window.removeEventListener('call:start', onStart)
  }, [])

  // ---- 刷新后恢复:服务器还有进行中的通话 ----
  useEffect(() => {
    fetch('/api/call/active').then((r) => r.json()).then((d) => {
      if (d.call && d.call.status !== 'ended') {
        offsetRef.current = Date.now() - (d.serverNow || Date.now())
        setCall(d.call); setPhase(d.call.status); setNeedTap(true); d.call.entries.forEach((e) => { if (e.who === 'him') himDoneRef.current.add(e.t) })
        setHistory(d.call.entries.map((e) => ({ who: e.who, text: e.text, zh: e.zh })))
      }
    }).catch(() => {})
  }, [])

  // ---- SSE ----
  const esRef = useRef(null)
  useEffect(() => {
    let es, stopped = false
    const connect = () => {
      if (stopped) return
      try { esRef.current?.close() } catch {}
      es = new EventSource('/api/stream'); esRef.current = es
      es.addEventListener('u', (e) => {
        let d; try { d = JSON.parse(e.data) } catch { return }
        if (d.type !== 'call') return
        let m; try { m = JSON.parse(d.content) } catch { return }
        onCallEvent(m)
      })
      es.onerror = () => { es.close(); setTimeout(connect, 4000) }
    }
    connect()
    const onVis = () => { if (!document.hidden) connect() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; es && es.close(); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  // 对账:通话进行中每 3 秒问一次服务器,SSE 漏掉的接听/句子/挂断都能补上
  const himSeenRef = useRef(0)
  const himDoneRef = useRef(new Set())   // 已处理过的他的句子(entry.t),SSE 和对账两条路都查它
  useEffect(() => {
    if (phase === 'idle' || phase === 'ended') return
    const t = setInterval(async () => {
      try {
        const d = await (await fetch('/api/call/active')).json()
        const c = callRef.current; if (!c) return
        const sc = d.call
        if (!sc || sc.id !== c.id) { // 服务器那边已经结束了
          try { const r = await (await fetch(`/api/call/${c.id}`)).json(); if (r.call?.status === 'ended') finish(r.call) } catch {}
          return
        }
        if (sc.status === 'active' && phaseRef.current === 'ringing') { setCall(sc); setPhase('active'); startMic() }
        const hims = sc.entries.filter((e) => e.who === 'him' && !himDoneRef.current.has(e.t))
        hims.forEach((e, i) => { himDoneRef.current.add(e.t); onFinal(e, !!sc.hangupPending && i === hims.length - 1) })
      } catch {}
    }, 3000)
    return () => clearInterval(t)
  }, [phase])

  const onCallEvent = (m) => {
    const c = callRef.current
    // 只认自己这台手机发起的通话(维修间/别的家的测试通话不会在这里响);他主动打来是三期
    if (m.ev === 'ring') { if (!c && m.call && m.call.by === 'him') { setCall(m.call); setPhase('ringing') } return }
    if (!c) return
    if ((m.call && m.call.id !== c.id) || (m.id && m.id !== c.id)) return
    if (m.ev === 'answer') { setCall(m.call); setPhase('active'); startMic() }
    else if (m.ev === 'seg') { busyRef.current = false; if (phaseRef.current === 'ringing') { setPhase('active'); startMic() } onSeg(m.text) }
    else if (m.ev === 'reset') { playQueue.current = playQueue.current.filter((x) => !x.entry.seg) }
    else if (m.ev === 'entry') { busyRef.current = false; if (m.entry.who === 'him' && !himDoneRef.current.has(m.entry.t)) { himDoneRef.current.add(m.entry.t); onFinal(m.entry, m.hangup) } }
    else if (m.ev === 'end') { finish(m.call) }
  }

  // ---- 发起 ----
  const start = async ({ session, model }) => {
    if (phaseRef.current !== 'idle') { setMin(false); return }
    try {
      // 手势里同步建音频上下文(iOS)
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current.resume().catch(() => {})
      unlockAudio()
      getWarmSocket()
      window.__inCall = true
      setPhase('ringing'); setMin(false); setHistory([]); setEndInfo(''); setSpeaking(null); setLive(''); himDoneRef.current = new Set(); turnRef.current = null; reconnRef.current = 0
      const r = await post('/api/call/start', { session, model })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setPhase('idle'); flash(d.error === 'busy' ? '已经在通话里了' : '没打出去'); cleanupMedia(); diag({ step: 'start-fail', status: r.status }); return }
      offsetRef.current = Date.now() - (d.serverNow || Date.now())
      setCall(d.call)
      // 麦克风接通才用,但提前要好,免得他一接就卡在权限弹窗
      try { streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); await ctxRef.current.resume() } catch (e) { diag({ step: 'mic-fail', err: String(e && e.message || e) }) }
      clearTimeout(ringTimer.current)
      ringTimer.current = setTimeout(() => { if (phaseRef.current === 'ringing') { hangUp('her'); finish({ ...(callRef.current || {}), endedBy: 'missed' }) } }, 55000)
    } catch (e) { setPhase('idle'); flash('没打出去'); cleanupMedia(); diag({ step: 'start-err', err: String(e && e.message || e) }) }
  }
  // 在用户手势里 play 一个静音片段,这个 <audio> 之后换 src 就能自由播放(iOS 规矩:非手势 new Audio().play() 会被拦)
  const unlockAudio = () => {
    if (!audioRef.current) { const a = new Audio(); a.setAttribute('playsinline', ''); a.preload = 'auto'; audioRef.current = a }
    try { const a = audioRef.current; a.src = SILENT; a.play().catch(() => {}) } catch {}
  }
  const playRetry = async (audio) => { try { await audio.play() } catch (e) { if (e && e.name === 'AbortError') { await new Promise((r) => setTimeout(r, 300)); await audio.play() } else throw e } }
  const diag = (o) => { try { post('/api/clientlog', { tag: 'call', ...o }).catch(() => {}) } catch {} }

  // ---- 麦克风:整通电话开着一条流式识别 ----
  const startMic = async () => {
    if (asrRef.current) return
    if (!reconnRef.current) await callAudio.start(speakerRef.current) // App:语音通话模式、允许蓝牙、屏幕不锁(重连时不重设)
    finalLenRef.current = 0
    try {
      if (!streamRef.current) streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      try { await ctxRef.current.resume() } catch {}
      if (needTap) { unlockAudio(); window.__inCall = true }
      asrRef.current = createAsrStream({
        ctx: ctxRef.current, stream: streamRef.current.clone(), ws: getWarmSocket(),
        onPartial: (all) => { if (!mutedRef.current && !typingRef.current) setLive(all.slice(finalLenRef.current)) },
        onFinal: (all, sentence) => { finalLenRef.current += sentence.length; if (!sentence.trim()) return; bufRef.current.push(sentence); setLive(''); scheduleFlush() },
        onError: () => { if (phaseRef.current !== 'active') return; const n = (reconnRef.current = (reconnRef.current || 0) + 1); try { asrRef.current?.cancel() } catch {} asrRef.current = null; if (n <= 20) setTimeout(() => { if (phaseRef.current === 'active' && !asrRef.current) startMic() }, 600); else flash('识别通道断了') },
      })
      asrRef.current.mute(mutedRef.current || playingRef.current)
      setNeedTap(false)
    } catch { flash('拿不到麦克风') }
  }
  const bufJoined = () => bufRef.current.join('')
  // 一句定稿后再等 1 秒没新话,就当她说完了这一段
  const scheduleFlush = () => { clearTimeout(bufTimer.current); bufTimer.current = setTimeout(flushBuf, 1000) }
  const flushBuf = () => {
    const text = bufRef.current.join('').trim(); bufRef.current = []
    if (!text) return
    setHistory((h) => [...h, { who: 'her', text }])
    say(text, 'voice')
  }
  const say = async (text, via) => {
    const c = callRef.current; if (!c) return
    if (busyRef.current) { sayQueue.current.push([text, via]); return }
    busyRef.current = true
    try {
      const r = await post('/api/call/say', { id: c.id, text, via })
      if (r.status === 429) { busyRef.current = true; sayQueue.current.unshift([text, via]); return }
      if (!r.ok) { busyRef.current = false; flash('没送到') }
    } catch { busyRef.current = false; flash('没送到') }
  }
  // 他答完(entry 到)或超时,把排队的话发出去
  useEffect(() => {
    const t = setInterval(() => {
      if (!busyRef.current && sayQueue.current.length && phaseRef.current === 'active') { const [text, via] = sayQueue.current.shift(); say(text, via) }
    }, 1500)
    return () => clearInterval(t)
  }, [])
  // 他太久没回也别永远卡住
  useEffect(() => { if (!busyRef.current) return; const t = setTimeout(() => { busyRef.current = false }, 90000); return () => clearTimeout(t) }, [speaking])

  // ---- 他的话:排队播 ----
  const enqueueHim = (entry, hangup) => { playQueue.current.push({ entry, hangup }); if (!playingRef.current) playNext() }
  // 流式来的一句:直接排队念,念完拼进当前这轮
  const onSeg = (text) => { if (!text) return; playQueue.current.push({ entry: { text, zh: '', seg: true } }); if (!playingRef.current) playNext() }
  // 整段落库:把已经念过的句子从全文里抠掉,剩下的尾巴念完;中文补到这轮上
  const onFinal = (entry, hangup) => {
    if (!entry.segs || !entry.segs.length) { enqueueHim(entry, hangup); return }
    let tail = entry.text.replace(/\s+/g, ' ').trim()
    const played = (turnRef.current?.played || []).concat(nowSegRef.current ? [nowSegRef.current] : [], playQueue.current.filter((x) => x.entry.seg).map((x) => x.entry.text))
    for (const sg of played) { const k = tail.indexOf(sg); if (k >= 0) tail = (tail.slice(0, k) + tail.slice(k + sg.length)).trim() }
    playQueue.current.push({ entry: { text: tail, zh: entry.zh, seg: true, final: true }, hangup })
    if (!playingRef.current) playNext()
  }
  // 这一轮已经念过的句子拼在一起(大字区显示整轮,当前句是最后一句);整轮说完才退成历史
  const turnAppend = (text, zh, close) => {
    const t = turnRef.current || { played: [], zh: '' }
    if (text) t.played = [...t.played, text]
    if (zh) t.zh = zh
    turnRef.current = t
    if (close) {
      const full = t.played.join(' ').trim()
      if (full) setHistory((h) => [...h, { who: 'him', text: full, zh: t.zh || '' }])
      turnRef.current = null
    }
  }
  const playNext = async () => {
    const item = playQueue.current.shift()
    if (!item) { playingRef.current = false; asrRef.current?.mute(mutedRef.current || typingRef.current); return }
    playingRef.current = true
    asrRef.current?.mute(true)
    const { entry, hangup } = item
    nowSegRef.current = entry.seg ? entry.text : ''
    const done = async () => {
      setSpeaking(null); nowSegRef.current = ''
      if (entry.seg) turnAppend(entry.text, entry.zh, !!entry.final)
      else setHistory((h) => [...h, { who: 'him', text: entry.text, zh: entry.zh }])
      if (hangup) { await hangUp('him'); return }
      playNext()
    }
    if (!entry.text) { done(); return }
    // 流式的一轮:大字区显示整轮到目前为止的话,正在念的这句在最后
    setSpeaking(entry.seg ? { text: [...(turnRef.current?.played || []), entry.text].join(' '), zh: entry.zh || turnRef.current?.zh || '', cur: entry.text } : { text: entry.text, zh: entry.zh })
    if (quietRef.current) { setTimeout(done, Math.min(12000, 1200 + entry.text.length * 55)); return }
    if (IOS && ctxRef.current) {
      try {
        let url = null
        try { url = (await (await post('/api/tts/url', { text: entry.text })).json()).url } catch {}
        if (!url) throw new Error('no url')
        const ctx = ctxRef.current
        try { await ctx.resume() } catch {}
        // 蓝牙耳机切换会把引擎打成挂起:塞进去也不出声,这时改走 <audio> 那条路
        if (ctx.state !== 'running') throw new Error('ctx ' + ctx.state)
        const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
        const srcNode = ctx.createBufferSource(); srcNode.buffer = buf; srcNode.connect(ctx.destination)
        srcRef.current = srcNode
        let ended = false
        srcNode.onended = () => { if (!ended) { ended = true; done() } }
        srcNode.start()
        setTimeout(() => { if (!ended) { ended = true; done() } }, buf.duration * 1000 + 1500)
        return
      } catch (e) { diag({ step: 'wa-fail', err: String(e && e.message || e) }) }
    }
    try {
      let url = null
      try { url = (await (await post('/api/tts/url', { text: entry.text, probe: true })).json()).url } catch {}
      if (!audioRef.current) unlockAudio()
      const audio = audioRef.current
      let ended = false, fellBack = false
      const finishOnce = () => { if (ended) return; ended = true; audio.onended = null; audio.onerror = null; done() }
      const fallback = async () => {
        if (ended || fellBack) return; fellBack = true
        try { const d = await (await post('/api/tts/url', { text: entry.text })).json(); if (!d.url) throw 0; audio.src = d.url; await audio.play() } catch { diag({ step: 'play-fail', text: entry.text.slice(0, 30) }); finishOnce() }
      }
      audio.onended = finishOnce
      audio.onerror = fallback
      // iPhone 对分块流不稳(第一句常卡在加载):没缓存就等桥生成完整文件再放,其他平台走流式
      if (!url && IOS) { try { url = (await (await post('/api/tts/url', { text: entry.text })).json()).url } catch {} }
      audio.src = url || `/api/tts/stream?t=${encodeURIComponent(entry.text)}`
      await playRetry(audio).catch((e) => { diag({ step: 'play-blocked', err: String(e && e.name || e) }); fallback() })
      setTimeout(() => { if (!ended && audio.paused) fallback() }, url ? 6000 : 4000)
    } catch { done() }
  }

  // ---- 挂断/结束 ----
  const hangUp = async (by = 'her') => {
    const c = callRef.current
    if (!c) { finish({ endedBy: 'her' }); return }
    try { const r = await post('/api/call/end', { id: c.id, by }); if (!r.ok) finish({ ...c, endedBy: by }) } catch { finish({ ...c, endedBy: by }) }
  }
  const finish = (c) => {
    if (phaseRef.current === 'idle') return
    window.__inCall = false
    clearTimeout(ringTimer.current)
    cleanupMedia()
    setCall(c); setPhase('ended'); setSpeaking(null); setLive('')
    const by = c?.endedBy
    setEndInfo(!c?.answeredAt && by === 'her' ? '已取消' : by === 'missed' ? '他没接到' : by === 'declined' ? '他现在不方便' : by === 'him' ? `他挂了 · ${fmt(dur(c))}` : `通话结束 · ${fmt(dur(c))}`)
    setTimeout(() => { setPhase('idle'); setCall(null); setHistory([]); setMin(false) }, 2600)
  }
  const cleanupMedia = () => {
    clearTimeout(bufTimer.current); bufRef.current = []; sayQueue.current = []; playQueue.current = []; playingRef.current = false; busyRef.current = false; turnRef.current = null
    try { asrRef.current?.cancel() } catch {} asrRef.current = null
    try { audioRef.current?.pause() } catch {}
    try { srcRef.current?.stop() } catch {} srcRef.current = null
    try { streamRef.current?.getTracks().forEach((t) => t.stop()) } catch {} streamRef.current = null
    try { ctxRef.current?.close() } catch {} ctxRef.current = null
    callAudio.end()
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute('src'); audioRef.current.load() } } catch {} audioRef.current = null
  }
  const dur = (c) => c?.answeredAt ? Math.max(0, Math.floor((now - (Date.parse(c.answeredAt) + offsetRef.current)) / 1000)) : 0
  const toggleMute = () => { const v = !muted; setMuted(v); asrRef.current?.mute(v || playingRef.current) }
  const micOff = () => muted || typing || playingRef.current
  const toggleTyping = () => { const v = !typing; setTyping(v); asrRef.current?.mute(muted || v || playingRef.current); if (v) { setLive(''); bufRef.current = [] } }
  useEffect(() => { asrRef.current?.mute(micOff()) }, [typing, muted])
  const sendTyped = () => { const t = input.trim(); if (!t) return; setInput(''); setHistory((h) => [...h, { who: 'her', text: t }]); say(t, 'text') }

  if (phase === 'idle') return toast ? <div className="call-toast glass3">{toast}</div> : null

  const status = phase === 'ringing' ? '呼叫中…' : phase === 'ended' ? endInfo : speaking ? `${NAMES.me} 在说…` : live ? '你在说…' : `通话中 ${fmt(dur(call))}`
  const anim = phase === 'active' && (speaking || live)

  if (min && phase !== 'ended') {
    return <button className={`call-pill glass3 ${anim ? 'anim' : ''}`} onClick={() => setMin(false)}><span className="call-pill-ico">☏</span><span className="call-pill-num">{phase === 'ringing' ? '呼叫中' : fmt(dur(call))}</span></button>
  }

  return (
    <div className={`call ${phase}`}>
      <div className="call-top">
        <button className="call-min" onClick={() => setMin(true)}>⌄</button>
        <span className="call-status serif">{status}</span>
        <span className="call-top-sp" />
      </div>
      <div className="call-hero">
        <div className={`call-bars him ${speaking ? 'on' : ''}`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}</div>
        <div className={`call-avatar ${phase === 'ringing' ? 'ring' : ''}`}><PixelCat size={70} style={{ display: 'block', margin: 'auto', objectFit: 'contain', imageRendering: 'pixelated' }} /></div>
        <div className="call-side">
          <div className={`call-bars her ${live ? 'on' : ''}`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}</div>
          {phase === 'active' && <span className={`call-mic ${micOff() ? 'off' : ''}`}>{muted ? '闭麦' : typing ? '打字中' : playingRef.current ? '他在说' : live ? '在听你说' : '在听'}</span>}
        </div>
      </div>
      <div className="call-name serif">{NAMES.me}</div>

      <div className="call-list" ref={listRef}>
        {history.map((h, i) => (
          <div key={i} className={`call-line ${h.who}`}>
            <span className="call-who">{h.who === 'him' ? NAMES.me : 'You'}</span>
            <span className="call-line-t">{h.text}</span>
            {h.zh && <span className="call-line-zh">{h.zh}</span>}
          </div>
        ))}
        {speaking && (
          <div className="call-cur him">
            <div className="call-cur-en serif">{speaking.cur && speaking.text.length > speaking.cur.length ? <><span className="call-cur-done">{speaking.text.slice(0, speaking.text.length - speaking.cur.length)}</span>{speaking.cur}</> : speaking.text}</div>
            {speaking.zh && <div className="call-cur-zh">{speaking.zh}</div>}
          </div>
        )}
        {!speaking && live && <div className="call-cur her"><div className="call-cur-en">{bufJoined()}{live}</div></div>}
        {!speaking && !live && bufRef.current.length > 0 && <div className="call-cur her"><div className="call-cur-en">{bufJoined()}</div></div>}
        {phase === 'ringing' && <div className="call-hint">等他接…</div>}
        {phase === 'active' && needTap && <button className="call-resume glass2" onClick={startMic}>点一下打开麦克风继续</button>}
        {phase === 'active' && !speaking && !live && !history.length && !needTap && <div className="call-hint">接通了,直接说就行</div>}
      </div>

      {typing && phase === 'active' && (
        <div className="call-type glass3">
          <textarea rows={1} value={input} onChange={(e) => { setInput(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 132) + 'px' }} placeholder="打字也算说话…(打字时麦克风关着)" autoFocus />
          <button className={input.trim() ? 'ready' : ''} onClick={sendTyped} disabled={!input.trim()}>↑</button>
        </div>
      )}
      <div className="call-ctl">
        <button className={`call-btn ${muted ? 'on' : ''}`} onClick={toggleMute} disabled={phase !== 'active'}><span>{muted ? Ic.micOff : Ic.mic}</span>{muted ? '闭麦' : '开麦'}</button>
        <button className={`call-btn ${typing ? 'on' : ''}`} onClick={toggleTyping} disabled={phase !== 'active'}><span>{Ic.pen}</span>打字</button>
        {isApp()
          ? <button className={`call-btn ${speaker ? 'on' : ''}`} onClick={async () => { const v = !speaker; setSpeaker(v); await callAudio.speaker(v) }} disabled={phase !== 'active'}><span>{Ic.spk}</span>{speaker ? '免提' : '听筒'}</button>
          : <button className={`call-btn ${quiet ? 'on' : ''}`} onClick={() => setQuiet((v) => !v)} disabled={phase !== 'active'}><span>{quiet ? Ic.spkOff : Ic.spk}</span>{quiet ? '只看字' : '放声音'}</button>}
        <button className="call-btn hang" onClick={() => hangUp('her')} disabled={phase === 'ended'}><span>{Ic.phone}</span>挂断</button>
      </div>
      {toast && <div className="call-toast glass3">{toast}</div>}
    </div>
  )
}
