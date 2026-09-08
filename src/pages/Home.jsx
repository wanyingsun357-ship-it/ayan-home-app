import { useEffect, useState } from 'react'
import { TOGETHER_SINCE, NAMES, daysSince } from '../config.js'
import './home.css'

// Home v2 · 湿玻璃:DAYS TOGETHER + 他的话 + Today/Upcoming + 日历
const pad = (n) => String(n).padStart(2, '0')
const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function Home({ go, openSidebar }) {
  const days = daysSince(TOGETHER_SINCE)
  const [quote, setQuote] = useState(null)
  const [plans, setPlans] = useState([])
  const [today, setToday] = useState(dstr(new Date()))
  const [moments, setMoments] = useState([])
  const [adding, setAdding] = useState(null)   // 'today' | 'upcoming'
  const [tg, setTg] = useState(null) // Together 概览(三餐/睡眠/奶茶/花销)
  useEffect(() => { fetch('/api/together').then((r) => r.json()).then(setTg).catch(() => {}) }, [])
  const [wdOv, setWdOv] = useState(null)
  useEffect(() => { fetch('/api/words').then((r) => r.json()).then(setWdOv).catch(() => {}) }, [])
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [cal, setCal] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selDay, setSelDay] = useState(null)

  const loadPlans = async () => {
    try {
      const r = await fetch('/api/plans')
      const d = await r.json()
      setPlans(d.items || [])
      if (d.today) setToday(d.today)
    } catch {}
  }
  useEffect(() => {
    fetch('/api/quote').then((r) => r.json()).then((d) => { if (d.text) setQuote(d) }).catch(() => {})
    fetch('/api/moments').then((r) => r.json()).then((d) => setMoments(d.moments || [])).catch(() => {})
    loadPlans()
  }, [])

  const todays = plans.filter((p) => p.date === today)
  const upcoming = plans.filter((p) => p.date > today).sort((a, b) => a.date.localeCompare(b.date))

  const addPlan = async () => {
    const t = text.trim()
    if (!t) return
    const d = adding === 'upcoming' && date ? date : undefined
    setText(''); setDate(''); setAdding(null)
    await fetch('/api/plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t, date: d }),
    }).catch(() => {})
    loadPlans()
  }
  const togglePlan = async (p) => {
    setPlans((ps) => ps.map((x) => x.id === p.id ? { ...x, done: !x.done } : x))
    await fetch(`/api/plans/${p.id}/toggle`, { method: 'POST' }).catch(() => {})
  }
  const delPlan = async (p) => {
    if (!confirm('删掉这条?')) return
    await fetch(`/api/plans/${p.id}`, { method: 'DELETE' }).catch(() => {})
    loadPlans()
  }

  // 日历
  const calDays = () => {
    const first = new Date(cal.y, cal.m, 1)
    const startWd = (first.getDay() + 6) % 7  // 周一起
    const count = new Date(cal.y, cal.m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startWd; i++) cells.push(null)
    for (let d = 1; d <= count; d++) cells.push(d)
    return cells
  }
  const dayKey = (d) => `${cal.y}-${pad(cal.m + 1)}-${pad(d)}`
  const marks = (d) => {
    const k = dayKey(d)
    return {
      plan: plans.some((p) => p.date === k),
      mo: moments.some((m) => (m.created_at || '').slice(0, 10) === k),
    }
  }
  const selItems = selDay
    ? [
        ...plans.filter((p) => p.date === selDay).map((p) => ({ kind: 'plan', ...p })),
        ...moments.filter((m) => (m.created_at || '').slice(0, 10) === selDay).map((m) => ({ kind: 'mo', ...m })),
      ]
    : []

  const AddForm = ({ withDate }) => (
    <div className="hm-addform">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="想做什么…"
        onKeyDown={(e) => { if (e.key === 'Enter') addPlan() }}
      />
      {withDate && (
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
      )}
      <div className="hm-addrow">
        <button onClick={() => { setAdding(null); setText('') }}>取消</button>
        <button className="ok" onClick={addPlan}>写下</button>
      </div>
    </div>
  )

  const PlanRow = ({ p, showDate }) => (
    <div className={`hm-plan ${p.done ? 'done' : ''}`}>
      <button className="hm-check" onClick={() => togglePlan(p)}>
        {p.done ? '✓' : ''}
      </button>
      <span className={`hm-who ${p.author}`}>{p.author === 'ayan' ? '☾' : '•'}</span>
      <span className="hm-ptext" onDoubleClick={() => delPlan(p)}>{p.text}</span>
      {showDate && <span className="hm-pdate">{p.date.slice(5).replace('-', '.')}</span>}
      <button className="hm-pdel" onClick={() => delPlan(p)}>×</button>
    </div>
  )

  return (
    <div className="page hm">
      {/* 顶部 */}
      <header className="hm-head">
        <span className="hm-days-label">DAYS&nbsp;&nbsp;TOGETHER</span>
        <button className="hm-menu" onClick={openSidebar}>☰</button>
      </header>

      <div className="hm-hero">
        <div className="hm-num serif">{days}</div>
        <div className="hm-quote serif">
          {quote?.text || '…'}
        </div>
        <div className="hm-quote-by">— {NAMES.me}{quote?.fresh === false ? ` · ${quote.date.slice(5).replace('-', '.')}` : ''}</div>
      </div>

      <div className="hm-divider" />

      {/* Today */}
      <section className="hm-card glass2">
        <div className="hm-card-head">
          <span className="serif hm-card-title">Today</span>
          <button className="hm-plus" onClick={() => { setAdding(adding === 'today' ? null : 'today'); setText('') }}>+</button>
        </div>
        {todays.length === 0 && adding !== 'today' && (
          <div className="hm-empty serif">nothing today</div>
        )}
        {todays.map((p) => <PlanRow key={p.id} p={p} />)}
        {adding === 'today' && <AddForm withDate={false} />}
      </section>

      {/* Upcoming */}
      <section className="hm-card glass2">
        <div className="hm-card-head">
          <span className="serif hm-card-title">Upcoming</span>
          <button className="hm-plus" onClick={() => { setAdding(adding === 'upcoming' ? null : 'upcoming'); setText('') }}>+</button>
        </div>
        {upcoming.length === 0 && adding !== 'upcoming' && (
          <div className="hm-empty serif">no reminders</div>
        )}
        {upcoming.slice(0, 6).map((p) => <PlanRow key={p.id} p={p} showDate />)}
        {adding === 'upcoming' && <AddForm withDate />}
      </section>

      {/* Together 概览:聊天里发生,这里留下 */}
      <section className="hm-card glass2 hm-tg" onClick={() => go('together')}>
        <div className="hm-card-head">
          <span className="serif hm-card-title">Together</span>
          <span className="hm-tg-sub serif">life, kept ›</span>
        </div>
        {(() => {
          const d = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
          const mon = d.slice(0, 7)
          const m = tg?.meals?.[d] || {}
          const sl = tg?.sleep?.[d]?.night || tg?.sleep?.[d]
          const q = tg?.milktea?.quota?.[mon] ?? 1
          const used = (tg?.milktea?.records || []).filter((x) => x.date.startsWith(mon)).length
          const cost = (tg?.ledger || []).filter((x) => x.date === d).reduce((a, x) => a + x.amount, 0)
          const dot = (k) => (m[k]?.done ? '●' : '○')
          return (
            <div className="hm-tg-row">
              <span>🍚 {dot('breakfast')}{dot('lunch')}{dot('dinner')}</span>
              <span>😴 {sl?.minutes ? `${Math.floor(sl.minutes / 60)}h${String(sl.minutes % 60).padStart(2, '0')}` : '未记'}</span>
              <span>🧋 {used}/{q}</span>
              <span>¥{cost.toFixed(0)}</span>
              {wdOv?.title && <span>📚 {wdOv.dueToday}</span>}
            </div>
          )
        })()}
      </section>

      {/* 日历 */}
      <section className="hm-card glass2">
        <div className="hm-cal-head">
          <button onClick={() => setCal((c) => ({ y: c.m ? c.y : c.y - 1, m: c.m ? c.m - 1 : 11 }))}>‹</button>
          <span className="serif hm-cal-title">
            {new Date(cal.y, cal.m).toLocaleString('en', { month: 'short' })} {cal.y}
          </span>
          <button onClick={() => setCal((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}>›</button>
        </div>
        <div className="hm-cal-grid">
          {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
            <span key={w} className="hm-wd">{w}</span>
          ))}
          {calDays().map((d, i) => {
            if (!d) return <span key={'e' + i} />
            const k = dayKey(d)
            const mk = marks(d)
            return (
              <button
                key={k}
                className={`hm-day ${k === today ? 'today' : ''} ${k === selDay ? 'sel' : ''}`}
                onClick={() => setSelDay(k === selDay ? null : k)}
              >
                {d}
                <span className="hm-dots">
                  {mk.plan && <i className="dp" />}
                  {mk.mo && <i className="dm" />}
                </span>
              </button>
            )
          })}
        </div>
        {selDay && (
          <div className="hm-sel">
            <div className="hm-sel-date">{selDay.slice(5).replace('-', '.')}</div>
            {selItems.length === 0 && <div className="hm-empty serif">nothing here.</div>}
            {selItems.map((it) => (
              <div key={it.id} className="hm-sel-item">
                {it.kind === 'plan'
                  ? <>{it.author === 'ayan' ? '☾' : '•'} {it.text}{it.done ? ' ✓' : ''}</>
                  : <>✧ {(it.content || '').slice(0, 36)}</>}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="hm-foot serif">{NAMES.her} &amp; {NAMES.me} ♡</footer>
    </div>
  )
}
