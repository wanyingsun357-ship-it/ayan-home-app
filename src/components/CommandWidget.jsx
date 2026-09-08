import { useEffect, useRef, useState } from 'react'
import { buzz } from '../utils/native.js'
import './command.css'

// 指令浮窗:他下任务 → 右侧贴边药丸(倒计时+细线) → 点开卡片 → 左滑完成 / 长按取消
// 计时只记 startedAt,每帧用 now-start 算,后台节流也不会乱
const pad = (n) => String(Math.max(0, n)).padStart(2, '0')
const fmt = (sec) => { const s = Math.abs(sec); const m = Math.floor(s / 60); return `${pad(m)}:${pad(s % 60)}` }

export default function CommandWidget() {
  const [queue, setQueue] = useState([])      // 未完成的指令,只显示第一个
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [flash, setFlash] = useState(null)    // {kind:'done'|'cancel', text}
  const [holding, setHolding] = useState(0)   // 长按进度 0-1
  const holdRef = useRef(null)
  const offsetRef = useRef(0)                 // 她的设备时钟 - 服务器时钟(差几秒倒计时就飘几秒)
  const syncOffset = (serverNow) => { if (serverNow) offsetRef.current = Date.now() - serverNow }
  const swipeRef = useRef(null)
  const cur = queue[0]

  // 拉未完成 + 监听实时事件
  useEffect(() => {
    let stopped = false
    const load = async () => {
      try { const d = await (await fetch('/api/commands/pending')).json(); syncOffset(d.serverNow); if (!stopped) setQueue(d.commands || []) } catch {}
    }
    load()
    let es
    const connect = () => {
      if (stopped) return
      es = new EventSource('/api/stream')
      es.addEventListener('u', (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.type === 'command') { const c = JSON.parse(d.content); setQueue((q) => (q.some((x) => x.id === c.id) ? q : [...q, c])); buzz([20, 40, 20]) }
          else if (d.type === 'command_done') { const c = JSON.parse(d.content); setQueue((q) => q.filter((x) => x.id !== c.id)) }
        } catch {}
      })
      es.onerror = () => { es.close(); setTimeout(connect, 4000) }
    }
    connect()
    const t = setInterval(load, 60000)
    return () => { stopped = true; clearInterval(t); es && es.close() }
  }, [])

  // 首次显示回写开始时间
  useEffect(() => {
    if (!cur || cur.startedAt) return
    fetch('/api/commands/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cur.id }) })
      .then((r) => r.json()).then((d) => { syncOffset(d.serverNow); if (d.command) setQueue((q) => q.map((x) => (x.id === d.command.id ? d.command : x))) }).catch(() => {})
  }, [cur?.id])

  // 每帧刷新
  useEffect(() => {
    if (!cur) return
    let raf
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cur?.id])

  const finish = async (kind) => {
    if (!cur) return
    const c = cur
    setOpen(false); setHolding(0)
    try { await fetch(`/api/commands/${kind === 'done' ? 'done' : 'cancel'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) }) } catch {}
    setQueue((q) => q.filter((x) => x.id !== c.id))
    const used = Math.max(0, Math.round((Date.now() - ((c.startedAt || c.createdAt) + offsetRef.current)) / 1000))
    setFlash({ kind, text: kind === 'done' ? `已完成 · 用时 ${fmt(used)}` : '已取消' })
    buzz(kind === 'done' ? [15, 30, 15] : 30)
    setTimeout(() => setFlash(null), 3200)
  }

  // 长按取消:按住 1.1 秒画满圆环才执行
  const holdStart = () => {
    const t0 = Date.now()
    clearInterval(holdRef.current)
    holdRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1100)
      setHolding(p)
      if (p >= 1) { clearInterval(holdRef.current); finish('cancel') }
    }, 30)
  }
  const holdEnd = () => { clearInterval(holdRef.current); setHolding(0) }
  // 左滑完成
  const onTouchStart = (e) => { swipeRef.current = e.touches ? e.touches[0].clientX : e.clientX }
  const onTouchEnd = (e) => {
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
    if (swipeRef.current != null && swipeRef.current - x > 70) finish('done')
    swipeRef.current = null
  }

  if (!cur && !flash) return null
  if (!cur && flash) return <div className={`cmd-flash glass3 ${flash.kind}`}>{flash.kind === 'done' ? '✓' : '✕'} {flash.text}</div>

  const start = (cur.startedAt || cur.createdAt) + offsetRef.current // 换算到她设备的时钟
  const elapsed = Math.max(0, Math.floor((now - start) / 1000))
  const total = cur.countdown || 0
  const remain = total ? total - elapsed : null
  const over = total ? remain < 0 : false
  const progress = total ? Math.min(1, elapsed / total) : 0
  const since = new Date(start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const big = total ? (over ? '+' + fmt(remain) : fmt(remain)) : fmt(elapsed)

  return (
    <>
      {!open && (
        <button className={`cmd-pill glass3 ${over ? 'over' : ''}`} onClick={() => setOpen(true)}>
          <span className="cmd-pill-ico">☾</span>
          <span className="cmd-pill-num">{big}</span>
          {queue.length > 1 && <span className="cmd-pill-more">+{queue.length - 1}</span>}
          <i className="cmd-line"><b style={{ transform: `scaleY(${over ? 1 : progress})` }} /></i>
        </button>
      )}
      {open && (
        <div className={`cmd-card glass3 ${over ? 'over' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseDown={onTouchStart} onMouseUp={onTouchEnd}>
          <div className="cmd-card-top">
            <span className="cmd-tag"><i />指令{cur.by === 'ayan' ? '' : ' · 自己'}</span>
            <button className="cmd-fold" onClick={() => setOpen(false)}>⌃</button>
          </div>
          <div className="cmd-title">{cur.title}</div>
          <div className="cmd-big-row">
            <span className="cmd-big">{big}</span>
            <span className="cmd-big-sub">{total ? (over ? '已超时' : '还剩') : '已用'}</span>
            <span className="cmd-since">{since} 起</span>
          </div>
          <div className="cmd-bar"><b style={{ transform: `scaleX(${over ? 1 : (total ? progress : 0.02)})` }} /></div>
          <div className="cmd-hint">
            <button className="cmd-act" onClick={() => finish('done')}>› 左滑完成</button>
            <button className="cmd-act cancel" onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}>
              长按取消
              {holding > 0 && <svg className="cmd-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" strokeDasharray={`${holding * 94.2} 94.2`} /></svg>}
            </button>
          </div>
          {queue.length > 1 && <div className="cmd-queue">还有 {queue.length - 1} 个排队</div>}
        </div>
      )}
    </>
  )
}
