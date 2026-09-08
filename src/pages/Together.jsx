import { useEffect, useMemo, useState } from 'react'
import PixelCat from '../components/PixelCat.jsx'
import './together.css'

// Together:她和他共同维护的长期生活空间。聊天里发生,这里留下;两个人都能记、都能改
const MODULES = [
  { key: 'meals', label: '三餐', icon: '🍚', slogan: '吃了什么不重要,吃了就好。' },
  { key: 'sleep', label: '睡眠', icon: '😴', slogan: '早点睡。你知道我会说这句话。' },
  { key: 'ledger', label: '记账', icon: '¥', slogan: '花了就花了,记一下就行。' },
  { key: 'milktea', label: '奶茶', icon: '🧋', slogan: '这个月的额度我说了算。但你撒娇的话另说。' },
  { key: 'words', label: '单词', icon: '📚', slogan: '一天三十个,我陪你考。' },
  { key: 'mistakes', label: '错词', icon: '✗', slogan: '错过的词,下次就是你的。' },
  { key: 'rules', label: '奖惩', icon: '⭐', soon: true },
]
const CATS = ['餐饮', '交通', '学习', '购物', '零食', '其他']
const bj = (offsetDays = 0) => new Date(Date.now() + 8 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10)
const fmtD = (d) => d ? `${parseInt(d.slice(5, 7), 10)}/${parseInt(d.slice(8, 10), 10)}` : ''
const dur = (mm) => mm ? `${Math.floor(mm / 60)}h${String(mm % 60).padStart(2, '0')}m` : '—'
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00+08:00') + n * 86400000).toISOString().slice(0, 10)
const Who = ({ by, at }) => (
  <span className={`tg-who ${by === 'ayan' ? 'him' : 'her'}`}>
    <i />{by === 'ayan' ? '晏白' : '婉莹'}{at ? ` · ${new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
  </span>
)

export default function Together({ back, initial }) {
  const [mod, setMod] = useState(initial || 'meals')
  const [data, setData] = useState(null)
  const [toast, setToast] = useState('')
  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 1800) }
  const load = async () => { try { setData(await (await fetch('/api/together')).json()) } catch {} }
  useEffect(() => { load() }, [])
  const post = async (path, body) => {
    try {
      const r = await fetch(`/api/together/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: 'wanying', ...body }) })
      if (!r.ok) { flash('没记上'); return null }
      await load()
      return await r.json()
    } catch { flash('没记上'); return null }
  }
  const current = MODULES.find((m) => m.key === mod)

  return (
    <div className="tg">
      <header className="tg-head">
        <button className="tg-back" onClick={back}>‹</button>
        <div>
          <div className="serif tg-title">Together</div>
          <div className="tg-sub serif">life, kept</div>
        </div>
      </header>
      <div className="tg-mods">
        {MODULES.map((m) => (
          <button key={m.key} className={`tg-mod ${mod === m.key ? 'on' : ''} ${m.soon ? 'soon' : ''}`} onClick={() => setMod(m.key)}>
            <span className="tg-mod-ico">{m.icon}</span>{m.label}
          </button>
        ))}
      </div>
      <div className="tg-body">
        {!data && <div className="tg-empty serif">opening…</div>}
        {data && mod === 'meals' && <Meals data={data} post={post} slogan={current.slogan} />}
        {data && mod === 'sleep' && <Sleep data={data} post={post} slogan={current.slogan} />}
        {data && mod === 'ledger' && <Ledger data={data} post={post} slogan={current.slogan} />}
        {data && mod === 'milktea' && <Milktea data={data} post={post} slogan={current.slogan} />}
        {data && mod === 'words' && <Words slogan={current.slogan} />}
        {data && mod === 'mistakes' && <Mistakes slogan={current.slogan} />}
        {data && ['rules'].includes(mod) && (
          <div className="tg-empty serif">soon.<div className="tg-hint">这个房间下一期装修 🫧</div></div>
        )}
      </div>
      {toast && <div className="tg-toast glass3">{toast}</div>}
    </div>
  )
}

// ---------- 模块头:蓝猫 + 标语 + 月亮(日历+本月总结) ----------
function ModHead({ slogan, day, onPick, marks, summary }) {
  const [open, setOpen] = useState(false)
  const [cal, setCal] = useState(() => ({ y: +day.slice(0, 4), m: +day.slice(5, 7) - 1 }))
  useEffect(() => { if (open) setCal({ y: +day.slice(0, 4), m: +day.slice(5, 7) - 1 }) }, [open])
  const monthKey = `${cal.y}-${String(cal.m + 1).padStart(2, '0')}`
  const days = useMemo(() => {
    const first = new Date(cal.y, cal.m, 1)
    const lead = (first.getDay() + 6) % 7
    const n = new Date(cal.y, cal.m + 1, 0).getDate()
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`)]
  }, [cal])
  const today = bj()
  return (
    <>
      <div className="tg-modhead glass2">
        <div className="tg-cat"><PixelCat size={54} /></div>
        <div className="tg-slogan serif">{slogan}</div>
        <button className={`tg-moon ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)}>☾</button>
      </div>
      {open && (
        <div className="tg-card glass2 tg-calcard">
          <div className="tg-cal-head">
            <button onClick={() => setCal((c) => ({ y: c.m ? c.y : c.y - 1, m: c.m ? c.m - 1 : 11 }))}>‹</button>
            <span className="serif tg-cal-title" onClick={() => { const y = prompt('年份', cal.y); if (y && /^\d{4}$/.test(y)) setCal((c) => ({ ...c, y: +y })) }}>
              {new Date(cal.y, cal.m).toLocaleString('en', { month: 'short' })} {cal.y}
            </span>
            <button onClick={() => setCal((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}>›</button>
          </div>
          <div className="tg-cal-grid">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => <span key={w} className="tg-cal-wd">{w}</span>)}
            {days.map((d, i) => d ? (
              <button key={d} className={`tg-cal-day ${d === today ? 'today' : ''} ${d === day ? 'sel' : ''} ${d > today ? 'future' : ''}`} onClick={() => { onPick(d); setOpen(false) }}>
                <span>{+d.slice(8, 10)}</span>
                <i className={`tg-cal-mark ${marks(d) || ''}`} />
              </button>
            ) : <span key={'e' + i} />)}
          </div>
          <div className="tg-sum">
            <div className="tg-sum-title serif">{monthKey.replace('-', ' · ')}{monthKey === today.slice(0, 7) ? ' · 截至今天' : ''}</div>
            {summary(monthKey)}
          </div>
        </div>
      )}
    </>
  )
}
const WeekBar = ({ day, setDay, render }) => {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(day, i - 6)), [day])
  return (
    <div className="tg-week">
      {days.map((d) => (
        <button key={d} className={`tg-wd ${d === day ? 'on' : ''}`} onClick={() => setDay(d)}>
          <span className="tg-wd-d">{fmtD(d)}</span>
          {render(d)}
        </button>
      ))}
    </div>
  )
}
const monthDays = (monthKey) => {
  const today = bj()
  const [y, m] = monthKey.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`).filter((d) => d <= today)
}

// ---------- 三餐 ----------
function Meals({ data, post, slogan }) {
  const [day, setDay] = useState(bj())
  const [editing, setEditing] = useState(null)
  const [note, setNote] = useState('')
  const m = data.meals[day] || {}
  const slots = [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐']]
  const cnt = (d) => ['breakfast', 'lunch', 'dinner'].filter((k) => data.meals[d]?.[k]?.done).length
  const summary = (mk) => {
    const ds = monthDays(mk)
    const tot = ds.length
    const by = (k) => ds.filter((d) => data.meals[d]?.[k]?.done).length
    const missed = ds.filter((d) => cnt(d) < 3).map((d) => `${fmtD(d)}${['早', '午', '晚'].filter((_, i) => !data.meals[d]?.[['breakfast', 'lunch', 'dinner'][i]]?.done).join('')}`)
    const full = ds.filter((d) => cnt(d) === 3).length
    return (
      <div className="tg-sum-body">
        <div className="tg-sum-row"><span>早餐</span><b>{by('breakfast')} / {tot} 天</b></div>
        <div className="tg-sum-row"><span>午餐</span><b>{by('lunch')} / {tot} 天</b></div>
        <div className="tg-sum-row"><span>晚餐</span><b>{by('dinner')} / {tot} 天</b></div>
        <div className="tg-sum-row"><span>三餐齐全</span><b>{full} 天</b></div>
        <div className="tg-sum-note">{missed.length ? `没吃齐:${missed.join(' · ')}` : tot ? '这个月一顿都没落下 🍚' : '还没开始记'}</div>
      </div>
    )
  }
  return (
    <>
      <ModHead slogan={slogan} day={day} onPick={setDay} marks={(d) => (cnt(d) === 3 ? 'full' : cnt(d) ? 'part' : '')} summary={summary} />
      <WeekBar day={day} setDay={setDay} render={(d) => <span className={`tg-wd-dots n${cnt(d)}`}>{'●'.repeat(cnt(d))}{'○'.repeat(3 - cnt(d))}</span>} />
      <div className="tg-card glass2">
        <div className="tg-card-head"><span className="serif">{day === bj() ? 'Today' : fmtD(day)}</span></div>
        {slots.map(([k, name]) => (
          <div key={k} className="tg-row">
            <button className={`tg-check ${m[k]?.done ? 'on' : ''}`} onClick={() => post('meal', { date: day, slot: k, done: !m[k]?.done })}>{m[k]?.done ? '✓' : ''}</button>
            <div className="tg-row-main" onClick={() => { setEditing(k); setNote(m[k]?.note || '') }}>
              <div className="tg-row-title">{name}</div>
              {editing === k ? (
                <div className="tg-inline">
                  <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="吃了什么…" />
                  <button onClick={(e) => { e.stopPropagation(); post('meal', { date: day, slot: k, note, done: m[k]?.done ?? true }); setEditing(null) }}>存</button>
                </div>
              ) : (
                <div className="tg-row-note">{m[k]?.note || <span className="dim">备注…</span>}</div>
              )}
              {m[k]?.at && <Who by={m[k].by} at={m[k].at} />}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------- 睡眠:晚上 + 午睡 ----------
function Sleep({ data, post, slogan }) {
  const [day, setDay] = useState(bj())
  const get = (d, k) => data.sleep[d]?.[k] || (k === 'night' && data.sleep[d]?.bed !== undefined ? data.sleep[d] : null)
  const summary = (mk) => {
    const ds = monthDays(mk)
    const nights = ds.map((d) => get(d, 'night')).filter((x) => x?.minutes)
    const naps = ds.map((d) => get(d, 'nap')).filter((x) => x?.minutes)
    const avg = nights.length ? Math.round(nights.reduce((a, x) => a + x.minutes, 0) / nights.length) : 0
    const latest = nights.map((x) => x.bed).filter(Boolean).sort((a, b) => ((a < '12' ? 1 : 0) - (b < '12' ? 1 : 0)) || b.localeCompare(a))[0]
    const short = nights.filter((x) => x.minutes < 6 * 60).length
    return (
      <div className="tg-sum-body">
        <div className="tg-sum-row"><span>记录</span><b>{nights.length} / {ds.length} 晚</b></div>
        <div className="tg-sum-row"><span>平均睡眠</span><b>{dur(avg)}</b></div>
        <div className="tg-sum-row"><span>不足6小时</span><b>{short} 晚</b></div>
        <div className="tg-sum-row"><span>最晚入睡</span><b>{latest || '—'}</b></div>
        <div className="tg-sum-row"><span>午睡</span><b>{naps.length} 次{naps.length ? ` · 平均${Math.round(naps.reduce((a, x) => a + x.minutes, 0) / naps.length)}分钟` : ''}</b></div>
      </div>
    )
  }
  return (
    <>
      <ModHead slogan={slogan} day={day} onPick={setDay} marks={(d) => (get(d, 'night')?.minutes ? 'full' : get(d, 'nap')?.minutes ? 'part' : '')} summary={summary} />
      <WeekBar day={day} setDay={setDay} render={(d) => <span className="tg-wd-sub">{get(d, 'night')?.minutes ? dur(get(d, 'night').minutes) : '·'}</span>} />
      <SleepCard title="晚上" kind="night" day={day} rec={get(day, 'night') || {}} post={post} hint="入睡 · 起床" />
      <SleepCard title="午睡" kind="nap" day={day} rec={get(day, 'nap') || {}} post={post} hint="躺下 · 醒来" />
    </>
  )
}
function SleepCard({ title, kind, day, rec, post, hint }) {
  const [bed, setBed] = useState(rec.bed || '')
  const [wake, setWake] = useState(rec.wake || '')
  const [note, setNote] = useState(rec.note || '')
  const guessBedDate = (b, w) => (b && w && b > w ? addDays(day, -1) : day) // 23:00睡08:00起→前一天
  const [bedDate, setBedDate] = useState(rec.bedDate || guessBedDate(rec.bed, rec.wake))
  const [touchedDate, setTouchedDate] = useState(!!rec.bedDate)
  useEffect(() => { setBed(rec.bed || ''); setWake(rec.wake || ''); setNote(rec.note || ''); setBedDate(rec.bedDate || guessBedDate(rec.bed, rec.wake)); setTouchedDate(!!rec.bedDate) }, [day, rec.at])
  useEffect(() => { if (kind === 'night' && !touchedDate) setBedDate(guessBedDate(bed, wake)) }, [bed, wake])
  return (
    <div className="tg-card glass2">
      <div className="tg-card-head"><span className="serif">{title}{day === bj() ? '' : ' · ' + fmtD(day)}</span><span className="tg-card-meta">{hint}</span></div>
      {kind === 'night' && (
        <div className="tg-beddate">
          <span>入睡日期</span>
          <input type="date" value={bedDate} onChange={(e) => { setBedDate(e.target.value); setTouchedDate(true) }} />
          <span className="dim">→ {fmtD(day)} 起床</span>
        </div>
      )}
      <div className="tg-sleep-grid">
        <label>{kind === 'nap' ? '躺下' : '入睡'}<input type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></label>
        <label>{kind === 'nap' ? '醒来' : '起床'}<input type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></label>
        <div className="tg-sleep-dur serif">{dur(rec.minutes)}</div>
      </div>
      <textarea className="tg-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'nap' ? '备注:课间眯了一会…' : '备注:昨天有点困…'} />
      <div className="tg-actions">
        {rec.at && <Who by={rec.by} at={rec.at} />}
        <button className="tg-btn" onClick={() => post('sleep', { date: day, kind, bed, wake, note, ...(kind === 'night' ? { bedDate } : {}) })}>保存</button>
      </div>
    </div>
  )
}

// ---------- 记账 ----------
function Ledger({ data, post, slogan }) {
  const [day, setDay] = useState(bj())
  const month = day.slice(0, 7)
  const [view, setView] = useState({ item: null })
  const [form, setForm] = useState(null)
  const items = data.ledger.filter((x) => x.date.startsWith(month)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const total = items.reduce((a, x) => a + x.amount, 0)
  const cats = {}
  for (const x of items) cats[x.category] = (cats[x.category] || 0) + x.amount
  const catList = Object.entries(cats).sort((a, b) => b[1] - a[1])
  const byDay = {}
  for (const x of items) (byDay[x.date] = byDay[x.date] || []).push(x)
  const summary = (mk) => {
    const list = data.ledger.filter((x) => x.date.startsWith(mk))
    const t = list.reduce((a, x) => a + x.amount, 0)
    const per = {}
    for (const x of list) per[x.date] = (per[x.date] || 0) + x.amount
    const top = Object.entries(per).sort((a, b) => b[1] - a[1])[0]
    const c = {}
    for (const x of list) c[x.category] = (c[x.category] || 0) + x.amount
    const topCat = Object.entries(c).sort((a, b) => b[1] - a[1])[0]
    const days = monthDays(mk).length || 1
    return (
      <div className="tg-sum-body">
        <div className="tg-sum-row"><span>总支出</span><b>¥{t.toFixed(2)}</b></div>
        <div className="tg-sum-row"><span>笔数</span><b>{list.length} 笔 · 日均 ¥{(t / days).toFixed(1)}</b></div>
        <div className="tg-sum-row"><span>最高一天</span><b>{top ? `${fmtD(top[0])} ¥${top[1].toFixed(0)}` : '—'}</b></div>
        <div className="tg-sum-row"><span>最大类别</span><b>{topCat ? `${topCat[0]} ¥${topCat[1].toFixed(0)}` : '—'}</b></div>
        {data.summaries.find((x) => x.month === mk) && <div className="tg-sum-note">他写过这个月的总结,在下面的卡片里</div>}
      </div>
    )
  }
  const it = view.item
  const summary0 = data.summaries.find((x) => x.month === month)
  return (
    <>
      <ModHead slogan={slogan} day={day} onPick={setDay} marks={(d) => (data.ledger.some((x) => x.date === d) ? 'part' : '')} summary={summary} />
      <div className="tg-card glass2">
        <div className="tg-card-head">
          <button className="tg-nav" onClick={() => setDay(addDays(month + '-01', -1))}>‹</button>
          <span className="serif">{month.replace('-', ' · ')}</span>
          <button className="tg-nav" onClick={() => setDay(addDays(month + '-28', 5).slice(0, 7) + '-01')}>›</button>
        </div>
        <div className="tg-total serif">¥{total.toFixed(2)}</div>
        <div className="tg-cats">
          {catList.map(([k, v]) => (
            <div key={k} className="tg-cat"><span>{k}</span><i style={{ width: `${Math.max(6, v / (total || 1) * 100)}%` }} /><b>¥{v.toFixed(0)}</b></div>
          ))}
          {!catList.length && <div className="tg-empty serif">nothing spent</div>}
        </div>
        <button className="tg-btn" onClick={() => setForm({ amount: '', category: '餐饮', note: '', date: day <= bj() ? day : bj() })}>＋ 记一笔</button>
      </div>
      {form && (
        <div className="tg-card glass2 tg-form">
          <div className="tg-form-row"><input type="number" inputMode="decimal" placeholder="金额" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="tg-chips">{CATS.map((c) => <button key={c} className={`tg-chip ${form.category === c ? 'on' : ''}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>)}</div>
          <input placeholder="备注:食堂午饭" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="tg-actions"><button className="tg-btn ghost" onClick={() => setForm(null)}>取消</button><button className="tg-btn" onClick={async () => { if (await post('ledger', { op: 'add', ...form })) setForm(null) }}>记上</button></div>
        </div>
      )}
      {summary0 && (
        <div className="tg-card glass2 tg-summary">
          <div className="tg-card-head"><span className="serif">{month.slice(5)}月总结</span><Who by={summary0.by} at={summary0.at} /></div>
          <div className="tg-summary-text">{summary0.text}</div>
        </div>
      )}
      {Object.entries(byDay).map(([d, list]) => (
        <div key={d} className="tg-card glass2">
          <div className="tg-card-head"><span className="serif">{fmtD(d)}</span><span className="tg-card-meta">¥{list.reduce((a, x) => a + x.amount, 0).toFixed(2)}</span></div>
          {list.map((x) => (
            <div key={x.id} className="tg-row tg-ledger-row" onClick={() => setView({ item: it?.id === x.id ? null : x })}>
              <span className="tg-ledger-cat">{x.category}</span>
              <span className="tg-ledger-note">{x.note || '—'}</span>
              <span className="tg-ledger-amt">¥{x.amount.toFixed(2)}</span>
            </div>
          ))}
          {it && it.date === d && (
            <div className="tg-detail">
              <div>{it.date} {it.time} · {it.category}</div>
              <div>备注:{it.note || '—'}</div>
              <Who by={it.by} at={it.at} />{it.editedBy && <span className="dim"> · {it.editedBy === 'ayan' ? '晏白' : '婉莹'}改过</span>}
              <div className="tg-actions">
                <button className="tg-btn ghost" onClick={async () => { const v = prompt('改金额', it.amount); if (v !== null) await post('ledger', { op: 'update', id: it.id, amount: v }) }}>改金额</button>
                <button className="tg-btn ghost" onClick={async () => { const v = prompt('改备注', it.note); if (v !== null) await post('ledger', { op: 'update', id: it.id, note: v }) }}>改备注</button>
                <button className="tg-btn danger" onClick={async () => { if (confirm('删掉这一笔?')) { await post('ledger', { op: 'remove', id: it.id }); setView({ item: null }) } }}>删</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// ---------- 奶茶 ----------
function Milktea({ data, post, slogan }) {
  const [day, setDay] = useState(bj())
  const month = day.slice(0, 7)
  const q = data.milktea.quota[month] ?? 1
  const recs = data.milktea.records.filter((x) => x.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date))
  const used = recs.length
  const [form, setForm] = useState(null)
  const summary = (mk) => {
    const list = data.milktea.records.filter((x) => x.date.startsWith(mk))
    const qq = data.milktea.quota[mk] ?? 1
    const shops = {}
    for (const x of list) shops[x.shop || '奶茶'] = (shops[x.shop || '奶茶'] || 0) + 1
    return (
      <div className="tg-sum-body">
        <div className="tg-sum-row"><span>喝了</span><b>{list.length} 杯 / 额度 {qq}</b></div>
        <div className="tg-sum-row"><span>超额</span><b>{list.length > qq ? `${list.length - qq} 杯` : '没有 👍'}</b></div>
        <div className="tg-sum-row"><span>最爱</span><b>{Object.entries(shops).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}×${v}`).join(' · ') || '—'}</b></div>
      </div>
    )
  }
  return (
    <>
      <ModHead slogan={slogan} day={day} onPick={setDay} marks={(d) => (data.milktea.records.some((x) => x.date === d) ? 'part' : '')} summary={summary} />
      <div className="tg-card glass2 tg-tea">
        <div className="tg-card-head"><span className="serif">{month.replace('-', ' · ')}</span>
          <button className="tg-nav" onClick={async () => { const v = prompt('本月额度(杯)', q); if (v !== null) await post('milktea', { op: 'quota', month, n: v }) }}>额度 {q}</button></div>
        <div className="tg-tea-ring">
          <div className="tg-tea-num serif">{used}<span>/{q}</span></div>
          <div className="tg-tea-label">{used > q ? `超额 ${used - q} 杯` : used === q ? '额度用完啦' : `还剩 ${q - used} 杯`}</div>
        </div>
        <button className="tg-btn" onClick={() => setForm({ shop: '', note: '', date: day <= bj() ? day : bj(), extra: used >= q })}>＋ 喝了一杯</button>
      </div>
      {form && (
        <div className="tg-card glass2 tg-form">
          <div className="tg-form-row"><input placeholder="哪家(喜茶/霸王茶姬…)" value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} /><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <input placeholder="备注:朋友请喝" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <label className="tg-switch"><input type="checkbox" checked={form.extra} onChange={(e) => setForm({ ...form, extra: e.target.checked })} /><span>这杯算超额</span></label>
          <div className="tg-actions"><button className="tg-btn ghost" onClick={() => setForm(null)}>取消</button><button className="tg-btn" onClick={async () => { if (await post('milktea', { op: 'add', ...form })) setForm(null) }}>记上</button></div>
        </div>
      )}
      <div className="tg-card glass2">
        {!recs.length && <div className="tg-empty serif">no tea yet</div>}
        {recs.map((x) => (
          <div key={x.id} className="tg-row tg-tea-row">
            <span className="tg-tea-date">{fmtD(x.date)}</span>
            <span className="tg-tea-main">{x.extra ? '+1 超额 · ' : '✓ '}{x.shop || '奶茶'}{x.note ? <span className="dim"> · {x.note}</span> : null}</span>
            <Who by={x.by} />
            <button className="tg-x" onClick={async () => { if (confirm('删掉?')) await post('milktea', { op: 'remove', id: x.id }) }}>×</button>
          </div>
        ))}
      </div>
    </>
  )
}


// ---------- 单词:词库(按天分组) ----------
const STATUS_LABEL = { new: '未考', learning: '在背', mastered: '已掌握' }
function Words({ slogan }) {
  const [ov, setOv] = useState(null)
  const [g, setG] = useState(null)      // {n,title,words}
  const [sel, setSel] = useState(null)  // 正在编辑的词
  const [busy, setBusy] = useState(false)
  const load = async () => { try { setOv(await (await fetch('/api/words')).json()) } catch {} }
  const openGroup = async (n) => { try { setG(await (await fetch(`/api/words/group?n=${n}`)).json()) } catch {} }
  useEffect(() => { load() }, [])
  const post = async (path, body) => {
    setBusy(true)
    try { const r = await fetch(`/api/words/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: 'wanying', ...body }) }); const d = await r.json(); if (!r.ok) alert(d.error || '没成'); await load(); if (g) await openGroup(g.n); return d } catch { alert('没成') } finally { setBusy(false) }
  }
  if (!ov) return <div className="tg-empty serif">opening…</div>
  const today = bj()
  return (
    <>
      <div className="tg-modhead glass2">
        <div className="tg-cat"><PixelCat size={54} /></div>
        <div className="tg-slogan serif">{slogan}</div>
      </div>
      {!ov.title && <div className="tg-card glass2 tg-empty serif">还没有词库。把 PDF/词表发给我,我帮你导进来。</div>}
      {ov.title && (
        <div className="tg-card glass2">
          <div className="tg-card-head"><span className="serif">{ov.title}</span><span className="tg-card-meta">当前 第{ov.cur.group}组</span></div>
          <div className="tg-wstats">
            <div><b>{ov.mastered}</b><span>已掌握 / {ov.total}</span></div>
            <div><b>{ov.dueToday}</b><span>今日待考</span></div>
            <div><b>{ov.mistakes}</b><span>重点复习</span></div>
          </div>
          <div className="tg-sum-note">聊天里说"考我单词",他会按今日词单考你;结果自动记进这里。</div>
        </div>
      )}
      {g ? (
        <div className="tg-card glass2">
          <div className="tg-card-head">
            <button className="tg-nav" onClick={() => setG(null)}>‹ 目录</button>
            <span className="serif">{g.title} · 第{g.n}组</span>
            <button className={`tg-nav ${ov.cur.group === g.n ? 'on' : ''}`} onClick={() => post('cur', { group: g.n })}>{ov.cur.group === g.n ? '今天考这组' : '设为今天'}</button>
          </div>
          {g.words.map((w) => (
            <div key={w.word} className={`tg-row tg-wrow st-${w.status}`} onClick={() => setSel({ ...w, meaningText: w.meaning })}>
              <span className="tg-wdot" />
              <span className="tg-wword">{w.word}<i>{w.ipa}</i></span>
              <span className="tg-wmean">{w.meaning}</span>
              <span className="tg-wtag">{w.srs?.wrong ? `错${w.srs.wrong}` : STATUS_LABEL[w.status]}</span>
            </div>
          ))}
          <button className="tg-btn ghost" onClick={async () => { const word = prompt('单词'); if (!word) return; const meaning = prompt('释义') || ''; await post('edit', { op: 'add', group: g.n, word: word.trim(), meaning }) }}>＋ 往这组加一个词</button>
        </div>
      ) : (
        <div className="tg-card glass2">
          {ov.groups.map((x) => (
            <button key={x.n} className={`tg-grow ${ov.cur.group === x.n ? 'cur' : ''}`} onClick={() => openGroup(x.n)}>
              <div className="tg-grow-top"><span className="serif">{x.title}</span><span className="tg-card-meta">{x.mastered} / {x.total} 已掌握{x.due ? ` · 待考 ${x.due}` : ''}</span></div>
              <div className="tg-gbar"><i style={{ width: `${x.mastered / (x.total || 1) * 100}%` }} /><b style={{ width: `${x.learning / (x.total || 1) * 100}%` }} /></div>
            </button>
          ))}
        </div>
      )}
      {sel && (
        <div className="sheet-mask" onClick={() => setSel(null)}>
          <div className="sheet thought" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="thought-body mem-detail">
              <div className="tg-wbig serif">{sel.word} <i>{sel.ipa}</i></div>
              <input className="mem-input" value={sel.meaningText} onChange={(e) => setSel({ ...sel, meaningText: e.target.value })} />
              {sel.srs && (
                <div className="tg-whist">
                  <div className="tg-sum-row"><span>状态</span><b>{STATUS_LABEL[sel.status]} · 对{sel.srs.right || 0} 错{sel.srs.wrong || 0}</b></div>
                  <div className="tg-sum-row"><span>下次复习</span><b>{sel.srs.due || '—'}</b></div>
                  <div className="tg-timeline">{(sel.srs.history || []).slice(-14).map((h, i) => <span key={i} className={h.ok ? 'ok' : 'no'} title={h.date}>{fmtD(h.date)} {h.ok ? '✓' : '✗'}</span>)}</div>
                </div>
              )}
              <div className="mem-echo-btns mem-card-actions">
                <button disabled={busy} className="mem-echo-btn on" onClick={async () => { await post('edit', { op: 'update', word: sel.word, meaning: sel.meaningText }); setSel(null) }}>保存释义</button>
                <button disabled={busy} className="mem-echo-btn" onClick={async () => { await post('queue', { word: sel.word, when: 'today', reason: '她自己加的' }); setSel(null) }}>加进今天</button>
                <button disabled={busy} className="mem-echo-btn" onClick={async () => { await post('edit', { op: 'master', word: sel.word }); setSel(null) }}>标记掌握</button>
                <button disabled={busy} className="mem-echo-btn danger" onClick={async () => { if (confirm('删掉这个词?')) { await post('edit', { op: 'remove', word: sel.word }); setSel(null) } }}>删</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- 错词 ----------
function Mistakes({ slogan }) {
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  const load = async () => { try { setList((await (await fetch('/api/words/mistakes')).json()).list || []) } catch { setList([]) } }
  useEffect(() => { load() }, [])
  const post = async (path, body) => { try { await fetch(`/api/words/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: 'wanying', ...body }) }); await load() } catch {} }
  const today = bj()
  return (
    <>
      <div className="tg-modhead glass2">
        <div className="tg-cat"><PixelCat size={54} /></div>
        <div className="tg-slogan serif">{slogan}</div>
      </div>
      <div className="tg-card glass2">
        {!list && <div className="tg-empty serif">opening…</div>}
        {list && !list.length && <div className="tg-empty serif">还没有错词。<div className="tg-hint">考过之后,错的会自动出现在这里</div></div>}
        {list && list.map((x) => (
          <div key={x.word} className="tg-row tg-mrow" onClick={() => setSel(sel?.word === x.word ? null : x)}>
            <div className="tg-mmain">
              <div className="tg-wword">{x.word}<i>{x.ipa}</i></div>
              <div className="tg-wmean">{x.meaning}</div>
              <div className="tg-mmeta">错 {x.wrong || 0} 次{x.last ? ` · 最近 ${fmtD(x.last)}` : ''}{x.queuedBy ? ` · ${x.queuedBy === 'ayan' ? '晏白' : '婉莹'}加的${x.queueReason ? '(' + x.queueReason + ')' : ''}` : ''}</div>
            </div>
            <div className={`tg-mdue ${x.due && x.due <= today ? 'due' : ''}`}>{x.due && x.due <= today ? '今天' : x.due ? `复习 ${fmtD(x.due)}` : '—'}</div>
            {sel?.word === x.word && (
              <div className="tg-mdetail" onClick={(e) => e.stopPropagation()}>
                <div className="tg-timeline">{(x.history || []).slice(-14).map((h, i) => <span key={i} className={h.ok ? 'ok' : 'no'}>{fmtD(h.date)} {h.ok ? '对' : '错'}</span>)}</div>
                <div className="tg-actions">
                  <button className="tg-btn ghost" onClick={() => post('queue', { word: x.word, when: 'today', reason: '再考一次' })}>加进今天</button>
                  <button className="tg-btn ghost" onClick={() => post('edit', { op: 'master', word: x.word })}>已掌握</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
