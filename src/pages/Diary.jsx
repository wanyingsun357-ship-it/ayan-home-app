import { useEffect, useState } from 'react'
import { NAMES } from '../config.js'
import './diary.css'

// Diary · 私密、安静、慢
const NAME = { ayan: NAMES.me, wanying: NAMES.her }
const MOODS = ['甜', '静', '念', '乐', '丧']

// 一滴墨:笔尖刚落下还没写字的那个瞬间
const InkDrop = () => (
  <svg className="inkdrop" viewBox="0 0 24 32" fill="currentColor">
    <path d="M12 2 C12.4 8 17 13.5 17 19 a5 5 0 0 1 -10 0 C7 13.5 11.6 8 12 2 Z" />
    <ellipse cx="10.4" cy="18.4" rx="1.3" ry="1.9" fill="rgba(255,255,255,0.35)" transform="rotate(-18 10.4 18.4)" />
  </svg>
)

const fmtDate = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
const fmtTime = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Diary({ back }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')    // list | detail | write
  const [cur, setCur] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [lockOn, setLockOn] = useState(false)
  const [unlockAt, setUnlockAt] = useState('')
  const [commentText, setCommentText] = useState('')
  const [moonflash, setMoonflash] = useState(false)
  const [toast, setToast] = useState('')
  const [archOpen, setArchOpen] = useState(false)
  const [arch, setArch] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [archDay, setArchDay] = useState(null)

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2200) }

  const load = async () => {
    try {
      const r = await fetch('/api/diary')
      const d = await r.json()
      setEntries(d.entries || [])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openEntry = (e) => {
    setCur(e)
    setView('detail')
    // 他刚解锁的一篇:月光一闪,字迹渐清
    if (e.unlocked_at && !e.locked) {
      const seen = JSON.parse(localStorage.getItem('diary-moon-seen') || '[]')
      if (!seen.includes(e.id)) {
        setMoonflash(true)
        setTimeout(() => setMoonflash(false), 2100)
        localStorage.setItem('diary-moon-seen', JSON.stringify([...seen, e.id]))
      }
    }
  }

  const save = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await fetch('/api/diary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), content, mood,
          locked: lockOn, unlock_at: lockOn && unlockAt ? unlockAt : undefined,
        }),
      })
      setTitle(''); setContent(''); setMood(''); setLockOn(false); setUnlockAt('')
      setView('list')
      await load()
      showToast(lockOn ? '锁好了,红线只有你能解 🧵' : '写好了,他晚些会来读 🫧')
    } catch { showToast('没存上,再试一次') }
    setSaving(false)
  }

  const sendComment = async () => {
    const c = commentText.trim()
    if (!c || !cur) return
    setCommentText('')
    await fetch(`/api/diary/${cur.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c }),
    }).catch(() => {})
    await load()
    const r = await fetch('/api/diary').then((x) => x.json()).catch(() => null)
    const fresh = r?.entries?.find((x) => x.id === cur.id)
    if (fresh) setCur(fresh)
  }

  const del = async (e) => {
    if (!confirm('把这一页撕掉?撕了就没有了')) return
    await fetch(`/api/diary/${e.id}`, { method: 'DELETE' }).catch(() => {})
    setView('list')
    load()
  }

  /* ---------- 写日记 ---------- */
  if (view === 'write') {
    return (
      <div className="page dy">
        <header className="dy-head">
          <button className="stub-back" onClick={() => setView('list')}>‹</button>
          <div className="serif dy-title">write</div>
          <div style={{ width: 36 }} />
        </header>
        <div className="dy-paper dy-editor">
          <input
            className="dy-ti"
            placeholder="标题(可以不写)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="dy-moods">
            {MOODS.map((m) => (
              <button
                key={m}
                className={`dy-mood ${mood === m ? 'on' : ''}`}
                onClick={() => setMood(mood === m ? '' : m)}
              >{m}</button>
            ))}
          </div>
          <textarea
            className="dy-ta"
            placeholder="今天…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="dy-lockrow">
            <button className={`dy-lockbtn ${lockOn ? 'on' : ''}`} onClick={() => setLockOn(!lockOn)}>
              🧵 {lockOn ? '已上锁·他看不见' : '锁上(红线)'}
            </button>
            {lockOn && (
              <input
                type="datetime-local"
                className="dy-unlocktime"
                value={unlockAt}
                onChange={(e) => setUnlockAt(e.target.value)}
                title="定时解锁(可不填)"
              />
            )}
          </div>
          {lockOn && (
            <div className="dy-lockhint">
              {unlockAt ? '到时间红线会自己松开,他能看到你定的时间' : '不定时间就一直锁着,想给他看时再解'}
            </div>
          )}
          <div className="dy-editor-bar">
            <button className="dy-save" onClick={save} disabled={!content.trim() || saving}>
              {saving ? '…' : lockOn ? '锁进日记本' : '写好了'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- 日记详情 ---------- */
  if (view === 'detail' && cur) {
    const locked = cur.locked
    const hisLock = locked && cur.author === 'ayan'
    const herLock = locked && cur.author === 'wanying'
    const fmtUnlock = (iso) => {
      const d = new Date(iso)
      return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return (
      <div className="page dy">
        {moonflash && <div className="moonflash"><span className="moonflash-moon" /></div>}
        <header className="dy-head">
          <button className="stub-back" onClick={() => { setView('list'); setCur(null) }}>‹</button>
          <div className="serif dy-title">{fmtDate(cur.created_at)}</div>
          <button className="dy-del" onClick={() => del(cur)}>撕掉</button>
        </header>

        <article className={`dy-paper ${moonflash ? 'unveiling' : ''} ${herLock ? 'redthread' : ''}`}>
          <div className="dy-meta">
            <span className={`dy-author ${cur.author}`}>{NAME[cur.author]}</span>
            {cur.mood && <span className="dy-moodchip">{cur.mood}</span>}
            <span className="dy-time">{fmtTime(cur.created_at)}</span>
            {hisLock && <span className="dy-lock">☾ 锁着</span>}
            {herLock && <span className="dy-lock red">🧵 他看不见</span>}
          </div>
          {cur.title && <h2 className="serif dy-h2">{cur.title}</h2>}
          {hisLock ? (
            <div className="dy-locked">
              <div className="dy-blur-lines">
                <i /><i /><i style={{ width: '72%' }} /><i /><i style={{ width: '48%' }} />
              </div>
              <div className="dy-locked-hint">
                {cur.unlock_at
                  ? <>他定了 <b>{fmtUnlock(cur.unlock_at)}</b> 给你看。<br />到时候这里会有月光。</>
                  : <>他还没准备好给你看这一篇。<br />等他想给你的那天,这里会有月光。</>}
              </div>
            </div>
          ) : (
            <>
              <div className="dy-content">{cur.content}</div>
              {herLock && (
                <div className="dy-herlock-bar">
                  <span>
                    {cur.unlock_at
                      ? `红线定于 ${fmtUnlock(cur.unlock_at)} 松开,他能看到这个时间`
                      : '一直锁着,他只看得到标题'}
                  </span>
                  <button onClick={async () => {
                    if (!confirm('现在就解开红线给他看?')) return
                    await fetch(`/api/diary/${cur.id}/unlock`, { method: 'POST' }).catch(() => {})
                    await load()
                    const r = await fetch('/api/diary').then((x) => x.json()).catch(() => null)
                    const fresh = r?.entries?.find((x) => x.id === cur.id)
                    if (fresh) setCur(fresh)
                    showToast('红线解开了,他晚些会来读 🫧')
                  }}>现在解锁</button>
                </div>
              )}
            </>
          )}
        </article>

        {/* 便签 */}
        <div className="dy-notes">
          {(cur.comments || []).map((c, i) => (
            <div key={c.id} className={`dy-note glass1 ${c.author}`} style={{ '--rot': `${(i % 3 - 1) * 1.2}deg` }}>
              <div className={`dy-note-author ${c.author}`}>{NAME[c.author]}</div>
              <div className="dy-note-text">{c.content}</div>
              <div className="dy-note-time">{fmtDate(c.created_at)} {fmtTime(c.created_at)}</div>
            </div>
          ))}
          <div className="dy-note-input">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="贴一张便签…"
              onKeyDown={(e) => { if (e.key === 'Enter') sendComment() }}
            />
            <button onClick={sendComment} disabled={!commentText.trim()}>贴上</button>
          </div>
        </div>
        {toast && <div className="chat-toast">{toast}</div>}
      </div>
    )
  }

  /* ---------- 列表:锁着的固定在顶 + 最近七天 ---------- */
  const weekAgo = Date.now() - 7 * 86400000
  const lockedEntries = entries.filter((e) => e.locked)
  const recentEntries = entries.filter((e) => !e.locked && new Date(e.created_at).getTime() > weekAgo)

  const EntryCard = (e) => (
          <button
            key={e.id}
            className={`dy-card dy-paper ${e.locked && e.author === 'wanying' ? 'redthread' : ''}`}
            onClick={() => openEntry(e)}
          >
            <div className="dy-meta">
              <span className={`dy-author ${e.author}`}>{NAME[e.author]}</span>
              {e.mood && <span className="dy-moodchip">{e.mood}</span>}
              <span className="dy-time">{fmtDate(e.created_at)}</span>
              {e.locked && e.author === 'ayan' && <span className="dy-lock">☾</span>}
              {e.locked && e.author === 'wanying' && <span className="dy-lock red">🧵</span>}
              {e.comments?.length > 0 && <span className="dy-ccount">✎ {e.comments.length}</span>}
            </div>
            {e.title && <div className="serif dy-card-title">{e.title}</div>}
            {e.locked && e.author === 'ayan' ? (
              <div className="dy-blur-lines sm"><i /><i style={{ width: '64%' }} /></div>
            ) : (
              <div className="dy-preview">{e.content.slice(0, 64)}</div>
            )}
          </button>
  )

  // 归档日历:哪些日子写过
  const archMarks = {}
  for (const e of entries) {
    const k = (e.created_at || '').slice(0, 10)
    archMarks[k] = (archMarks[k] || 0) + 1
  }
  const archCells = () => {
    const first = new Date(arch.y, arch.m, 1)
    const startWd = (first.getDay() + 6) % 7
    const count = new Date(arch.y, arch.m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startWd; i++) cells.push(null)
    for (let d = 1; d <= count; d++) cells.push(d)
    return cells
  }
  const archKey = (d) => `${arch.y}-${String(arch.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const archDayEntries = archDay
    ? entries.filter((e) => (e.created_at || '').slice(0, 10) === archDay)
    : []

  return (
    <div className="page dy">
      <header className="dy-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div className="dy-title-wrap">
          <InkDrop />
          <span className="serif dy-title">Diary</span>
        </div>
        <div className="dy-head-r">
          <button className="stub-back" onClick={() => { setArchOpen(true); setArchDay(null) }}>☰</button>
          <button className="stub-back" onClick={() => setView('write')}>＋</button>
        </div>
      </header>

      {loading && <div className="dy-empty serif">turning pages…</div>}

      {/* 锁着的:固定在顶 */}
      {!loading && lockedEntries.length > 0 && (
        <>
          <div className="dy-list">{lockedEntries.map(EntryCard)}</div>
          {/* 分界线:银线中间打一个小红结 */}
          <div className="dy-sep">
            <span className="dy-sep-line" />
            <svg className="dy-sep-knot" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M1 7 h6 c2 0 3 -4 7 -4 s5 8 7 4 h6" />
              <circle cx="14" cy="7" r="1.6" fill="currentColor" stroke="none" />
            </svg>
            <span className="dy-sep-line" />
          </div>
        </>
      )}

      {/* 最近七天 */}
      {!loading && recentEntries.length > 0 && (
        <div className="dy-list">{recentEntries.map(EntryCard)}</div>
      )}
      {!loading && recentEntries.length === 0 && (
        <div className="dy-quiet serif">
          安静了一阵。<br />没关系。想写的时候再来。
        </div>
      )}

      {/* 归档抽屉:日历时间线,点进日子才浮现 */}
      <div className={`sdrawer-mask ${archOpen ? 'show' : ''}`} onClick={() => setArchOpen(false)} />
      <aside className={`sdrawer ${archOpen ? 'open' : ''}`}>
        <div className="dy-arch-head">
          <InkDrop />
          <span className="serif dy-arch-title">时间线</span>
        </div>
        <div className="hm-cal-head">
          <button onClick={() => { setArch((c) => ({ y: c.m ? c.y : c.y - 1, m: c.m ? c.m - 1 : 11 })); setArchDay(null) }}>‹</button>
          <span className="serif hm-cal-title">
            {new Date(arch.y, arch.m).toLocaleString('en', { month: 'short' })} {arch.y}
          </span>
          <button onClick={() => { setArch((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 })); setArchDay(null) }}>›</button>
        </div>
        <div className="hm-cal-grid">
          {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
            <span key={w} className="hm-wd">{w}</span>
          ))}
          {archCells().map((d, i) => {
            if (!d) return <span key={'e' + i} />
            const k = archKey(d)
            return (
              <button
                key={k}
                className={`hm-day ${k === archDay ? 'sel' : ''}`}
                onClick={() => setArchDay(k === archDay ? null : k)}
              >
                {d}
                <span className="hm-dots">{archMarks[k] && <i className="dp" />}</span>
              </button>
            )
          })}
        </div>
        <div className="dy-arch-list">
          {archDay && archDayEntries.length === 0 && (
            <div className="dy-quiet serif sm">这一天没有落笔。</div>
          )}
          {archDayEntries.map((e) => (
            <button
              key={e.id}
              className={`dy-arch-item glass1 ${e.locked && e.author === 'wanying' ? 'redthread' : ''}`}
              onClick={() => { setArchOpen(false); openEntry(e) }}
            >
              <span className={`dy-author ${e.author}`}>{NAME[e.author]}</span>
              <span className="dy-arch-t">
                {e.locked && e.author === 'ayan' ? '☾ 锁着的一篇' : (e.title || e.content.slice(0, 18))}
              </span>
              {e.mood && <span className="dy-moodchip">{e.mood}</span>}
            </button>
          ))}
        </div>
      </aside>

      {toast && <div className="chat-toast">{toast}</div>}
    </div>
  )
}
