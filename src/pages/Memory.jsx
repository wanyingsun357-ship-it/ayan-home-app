import { useEffect, useState } from 'react'
import './memory.css'

// Memory · Things I remember. —— 和记忆库面板同款的筛选
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pinned', label: '📌 钉选' },
  { key: 'feel', label: '💧 Feel' },
  { key: 'unresolved', label: '⚡ 未解决' },
  { key: 'digested', label: '🍃 已消化' },
  { key: 'archived', label: '🗄 归档' },
]
const SORTS = [
  { key: 'score', label: '综合分优先' },
  { key: 'newest', label: '最新创建优先' },
  { key: 'oldest', label: '最早创建优先' },
]
const SECTIONS = [
  { key: 'buckets', label: '记忆', en: 'Memories' },
  { key: 'letters', label: '信', en: 'Letters' },
  { key: 'anchors', label: '锚点', en: 'Anchors' },
]

// 回声库:状态标签和颜色(生命周期0818)
const ECHO_ST = {
  ACTIVE: { label: '平常', cls: 'active' },
  PENDING: { label: '待兑现', cls: 'pending' },
  COMPLETED: { label: '已兑现', cls: 'completed' },
  SUPERSEDED: { label: '已过时', cls: 'superseded' },
  ARCHIVED: { label: '归档', cls: 'archived' },
}
const ECHO_CLS = { normal: '', slow: '🌿 慢忘', none: '📌 钉住' }

const fmtTime = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Memory({ back, goSettings }) {
  const [status, setStatus] = useState(null)
  const [all, setAll] = useState([])
  const [letters, setLetters] = useState([])
  const [anchors, setAnchors] = useState(null)
  const [section, setSection] = useState('buckets')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('score')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [searchItems, setSearchItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---- 回声库(他下意识的那一半记忆) ----
  const [mode, setMode] = useState('ob') // ob=记忆库 echo=回声
  const [echoStats, setEchoStats] = useState(null) // {buckets,statusCounts,flowToday,total}
  const [echoKey, setEchoKey] = useState(null)
  const [echoItems, setEchoItems] = useState(null) // {title, items}
  const [echoSel, setEchoSel] = useState(null)     // 长按/点开的条目
  const [echoBusy, setEchoBusy] = useState(false)
  const [echoFilter, setEchoFilter] = useState('all')   // all/PENDING/pinned/COMPLETED/gone
  const [echoSort, setEchoSort] = useState('newest')    // newest/oldest/act
  // ---- 档案卡(关于她的稳定事实,按实体聚合;她是终审) ----
  const [echoView, setEchoView] = useState('items')     // items=情景记忆 cards=档案卡
  const [cards, setCards] = useState(null)
  const [cardSel, setCardSel] = useState(null)          // 正在编辑的卡(可编辑副本)
  const [cardBusy, setCardBusy] = useState(false)
  const [echoEditText, setEchoEditText] = useState('')
  // ---- 印记画廊(他压缩后送的画) ----
  const [gifts, setGifts] = useState(null)
  const [giftView, setGiftView] = useState(null)
  useEffect(() => { if (mode === 'gifts' && !gifts) fetch('/api/gifts').then((r) => r.json()).then((d) => setGifts(d.gifts || [])).catch(() => setGifts([])) }, [mode])

  const loadEcho = async () => {
    try {
      const d = await (await fetch('/api/echo/items')).json()
      setEchoStats(d)
      if (!echoKey && d.buckets?.length) openEchoBucket(d.buckets[0].key)
    } catch {}
  }
  const openEchoBucket = async (key) => {
    setEchoKey(key)
    setEchoItems(null)
    try { setEchoItems(await (await fetch(`/api/echo/items?key=${encodeURIComponent(key)}`)).json()) } catch {}
  }
  useEffect(() => { if (mode === 'echo' && !echoStats) loadEcho() }, [mode])
  const loadCards = async (key = echoKey) => {
    if (!key) return
    try { setCards((await (await fetch(`/api/cards?key=${encodeURIComponent(key)}`)).json()).cards || []) } catch {}
  }
  useEffect(() => { if (echoView === 'cards' && echoKey) loadCards(echoKey) }, [echoKey, echoView])
  const cardPost = async (url, body) => {
    setCardBusy(true)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) alert(d.error || '没改动')
      await loadCards()
      return d
    } catch { alert('没改动') }
    finally { setCardBusy(false) }
  }
  const saveCard = async () => {
    if (!cardSel) return
    await cardPost('/api/cards/update', { id: cardSel.id, entity: cardSel.entity, aliases: (cardSel.aliasText || '').split(/[,，、\s]+/).filter(Boolean), facts: cardSel.facts })
    setCardSel(null)
  }
  const newCard = async () => {
    const entity = prompt('这张卡是关于谁/什么的?(比如:她的猫、室友、妈妈)')
    if (!entity || !entity.trim()) return
    const fact = prompt('先写一条事实(可留空)') || ''
    await cardPost('/api/cards/create', { key: echoKey, entity: entity.trim(), fact: fact.trim() })
  }
  const echoEdit = async (patch) => {
    if (!echoSel || echoBusy) return
    setEchoBusy(true)
    try {
      const r = await fetch('/api/echo/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: echoSel.id, ...patch }) })
      const d = await r.json()
      if (!r.ok) { alert(d.error || '改不动'); setEchoBusy(false); return }
      if (patch.remove) setEchoItems((v) => v ? { ...v, items: v.items.filter((x) => x.id !== echoSel.id) } : v)
      else setEchoItems((v) => v ? { ...v, items: v.items.map((x) => x.id === echoSel.id ? { ...x, text: d.item.text } : x) } : v)
      setEchoSel(null)
      loadEcho()
    } catch {}
    setEchoBusy(false)
  }

  const echoUpdate = async (patch) => {
    if (!echoSel || echoBusy) return
    setEchoBusy(true)
    try {
      const r = await fetch('/api/echo/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: echoSel.id, ...patch }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || '改不动'); setEchoBusy(false); return }
      setEchoItems((v) => v ? { ...v, items: v.items.map((x) => x.id === echoSel.id ? { ...x, ...d.item } : x) } : v)
      setEchoSel(null)
      loadEcho()
    } catch {}
    setEchoBusy(false)
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const [sd, bd, ld, ad] = await Promise.all([
        fetch('/api/ombre/status').then((r) => r.json()).catch(() => ({ available: false })),
        fetch('/api/ombre/buckets').then((r) => (r.ok ? r.json() : Promise.reject())),
        fetch('/api/ombre/letters').then((r) => (r.ok ? r.json() : { letters: [] })).catch(() => ({ letters: [] })),
        fetch('/api/ombre/anchors').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      setStatus(sd)
      setAll(bd.items || [])
      setLetters(ld.letters || [])
      setAnchors(ad)
    } catch {
      setError(true)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // 搜索(语义,走OB)
  useEffect(() => {
    if (!debounced) { setSearchItems(null); return }
    let dead = false
    fetch(`/api/ombre/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((d) => { if (!dead) setSearchItems(d.items || []) })
      .catch(() => { if (!dead) setSearchItems([]) })
    return () => { dead = true }
  }, [debounced])

  const openDetail = async (item) => {
    setSelected(item)
    if (item.kind === 'letter') return
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/ombre/buckets/${encodeURIComponent(item.id)}`)
      if (r.ok) setSelected({ ...(await r.json()), kind: item.kind })
    } catch {}
    setDetailLoading(false)
  }

  const needsPassword = status && status.configured === false

  // 筛选 + 排序(前端做,面板同款)
  const base = searchItems ?? all
  let shown = base.filter((m) => {
    if (filter === 'all') return m.type !== 'letter'
    if (filter === 'pinned') return m.pinned
    if (filter === 'feel') return m.type === 'feel'
    if (filter === 'unresolved') return !m.resolved && m.type !== 'letter' && m.type !== 'feel'
    if (filter === 'digested') return m.digested
    return false
  })
  shown = [...shown].sort((a, b) => {
    if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1)
    if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })

  return (
    <div className="page mem">
      <header className="mem-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div>
          <div className="serif mem-title">Memory</div>
          <div className="mem-sub serif">Things I remember.</div>
        </div>
        <span className={`mem-dot ${status?.available ? 'on' : ''}`} />
      </header>

      {/* 一份记忆的两面:他刻意写下的 | 他下意识沉淀的 */}
      <div className="mem-modes">
        <button className={`mem-mode ${mode === 'ob' ? 'on' : ''}`} onClick={() => setMode('ob')}>记忆库</button>
        <button className={`mem-mode ${mode === 'echo' ? 'on' : ''}`} onClick={() => setMode('echo')}>回声</button>
        <button className={`mem-mode ${mode === 'gifts' ? 'on' : ''}`} onClick={() => setMode('gifts')}>印记</button>
      </div>

      {mode === 'gifts' && (
        <>
          <div className="mem-status">{gifts ? `${gifts.length} 个印记 · 他在整理记忆时留下的` : 'gathering…'}</div>
          <div className="gift-wall">
            {gifts && gifts.length === 0 && <div className="mem-empty serif">还没有印记。值得的时刻,他会自己画下来。</div>}
            {gifts && gifts.map((g, i) => (
              <button key={i} className="gift-tile" onClick={() => setGiftView(g)}>
                <img src={g.url} alt={g.title} loading="lazy" />
                <div className="gift-tile-t serif">{g.title}</div>
                <div className="gift-tile-d">{(g.at || '').slice(0, 10)} · {g.home}</div>
              </button>
            ))}
          </div>
          {giftView && (
            <div className="gift-veil open" onClick={() => setGiftView(null)}>
              <div className="gift-reveal">
                <img src={giftView.url} alt={giftView.title} />
                <div className="gift-title serif">{giftView.title}</div>
                <div className="gift-note">{giftView.note}</div>
              </div>
              <div className="gift-hint">{(giftView.at || '').slice(0, 10)} · {giftView.home} · 轻点任意处收起</div>
            </div>
          )}
        </>
      )}

      {mode === 'gifts' ? null : mode === 'echo' ? (
        <>
          {!echoStats ? <div className="mem-empty serif">listening…</div> : (
            <>
              <div className="mem-status">
                {echoStats.total} echoes ·
                {' '}平常{echoStats.statusCounts?.ACTIVE || 0}
                {' '}待兑现{echoStats.statusCounts?.PENDING || 0}
                {' '}已兑现{echoStats.statusCounts?.COMPLETED || 0}
                {' '}过时{echoStats.statusCounts?.SUPERSEDED || 0}
                {' '}归档{echoStats.statusCounts?.ARCHIVED || 0}
              </div>
              <div className="mem-echo-flow">
                今日流转:兑现 {echoStats.flowToday?.COMPLETED || 0} · 覆盖 {echoStats.flowToday?.SUPERSEDED || 0} · 归档 {echoStats.flowToday?.ARCHIVED || 0}
              </div>
              <div className="mem-filters">
                {(echoStats.buckets || []).map((b) => (
                  <button key={b.key}
                    className={`mem-chip ${echoKey === b.key ? 'on' : ''}`}
                    onClick={() => openEchoBucket(b.key)}>
                    {b.title} · {b.n}
                  </button>
                ))}
              </div>
              <div className="mem-filters">
                <button className={`mem-chip ${echoView === 'items' ? 'on' : ''}`} onClick={() => setEchoView('items')}>💭 情景记忆</button>
                <button className={`mem-chip ${echoView === 'cards' ? 'on' : ''}`} onClick={() => setEchoView('cards')}>🗂 档案卡{cards ? ` · ${cards.length}` : ''}</button>
              </div>
              {echoView === 'cards' && (
                <div className="mem-list">
                  <div className="mem-echo-flow">关于你的稳定事实,按人/物聚合。自动抽取难免出错——点开随手改,你说了算。</div>
                  <button className="mem-card glass2 mem-card-new" onClick={newCard}>＋ 建一张新卡</button>
                  {!cards && <div className="mem-empty serif">opening the files…</div>}
                  {cards && cards.length === 0 && <div className="mem-empty serif">还没有卡。聊着聊着,他会慢慢立起来。</div>}
                  {cards && cards.map((c) => (
                    <button key={c.id} className="mem-card glass2 mem-echo-card" onClick={() => setCardSel({ ...c, facts: c.facts.map((f) => ({ ...f })), aliasText: (c.aliases || []).join(' ') })}>
                      <div className="mem-card-top">
                        <span className="mem-card-entity">{c.entity}</span>
                        <span className="mem-time">{(c.updatedAt || '').slice(0, 10)}</span>
                      </div>
                      <div className="mem-facts">
                        {c.facts.filter((f) => f.status === 'live').map((f) => <div key={f.id} className="mem-fact">· {f.text} <i>{f.date}</i></div>)}
                        {c.facts.filter((f) => f.status === 'stale').map((f) => <div key={f.id} className="mem-fact stale">· {f.text}</div>)}
                        {!c.facts.length && <div className="mem-fact dim">(空卡)</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {echoView === 'items' && (<>
              <div className="mem-filters">
                {[
                  ['all', '全部'], ['PENDING', '⏳ 待兑现'], ['pinned', '📌 钉住'],
                  ['COMPLETED', '✓ 已兑现'], ['gone', '🗄 过时/归档'],
                ].map(([k, l]) => (
                  <button key={k} className={`mem-chip ${echoFilter === k ? 'on' : ''}`} onClick={() => setEchoFilter(k)}>{l}</button>
                ))}
              </div>
              <div className="mem-sortrow">
                <span>⏱</span>
                <select value={echoSort} onChange={(e) => setEchoSort(e.target.value)}>
                  <option value="newest">最新优先</option>
                  <option value="oldest">最早优先</option>
                  <option value="act">常被想起优先</option>
                </select>
              </div>
              <div className="mem-list">
                {!echoItems && <div className="mem-empty serif">remembering…</div>}
                {echoItems && echoItems.items.length === 0 && <div className="mem-empty serif">这个仓还空着。</div>}
                {echoItems && echoItems.items
                  .filter((it) => {
                    if (echoFilter === 'all') return true
                    if (echoFilter === 'pinned') return it.decayClass === 'none'
                    if (echoFilter === 'gone') return it.status === 'SUPERSEDED' || it.status === 'ARCHIVED'
                    return it.status === echoFilter
                  })
                  .sort((a, b) => {
                    if (echoSort === 'act') return (b.act || 0) - (a.act || 0)
                    if (echoSort === 'oldest') return (a.date || '').localeCompare(b.date || '')
                    return (b.date || '').localeCompare(a.date || '')
                  })
                  .map((it) => (
                  <button key={it.id} className={`mem-card glass2 mem-echo-card ${it.status === 'SUPERSEDED' || it.status === 'ARCHIVED' ? 'dim' : ''}`}
                    onClick={() => { setEchoSel(it); setEchoEditText(it.text) }}>
                    <div className="mem-card-top">
                      <span className={`mem-echo-st ${ECHO_ST[it.status]?.cls || 'active'}`}>{ECHO_ST[it.status]?.label || it.status}</span>
                      {it.decayClass !== 'normal' && <span className="mem-echo-cls">{ECHO_CLS[it.decayClass]}</span>}
                      {(it.act || 0) > 0 && <span className="mem-echo-act">💭{it.act}</span>}
                      <span className="mem-time">{it.date}{it.event ? ` · ${it.event}` : ''}</span>
                    </div>
                    <div className="mem-preview mem-echo-text">{it.text}</div>
                  </button>
                ))}
              </div>
              </>)}
            </>
          )}

          {/* 档案卡编辑弹层 */}
          {cardSel && (
            <div className="sheet-mask" onClick={() => setCardSel(null)}>
              <div className="sheet thought" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div className="thought-body mem-detail">
                  <input className="mem-input mem-input-entity" value={cardSel.entity} onChange={(e) => setCardSel({ ...cardSel, entity: e.target.value })} placeholder="这张卡关于…" />
                  <input className="mem-input" value={cardSel.aliasText} onChange={(e) => setCardSel({ ...cardSel, aliasText: e.target.value })} placeholder="别名(空格隔开,她提到这些词时也会想起这张卡)" />
                  <div className="mem-echo-acts-t">事实(划掉=已不成立,保留划痕)</div>
                  {cardSel.facts.map((f, i) => (
                    <div key={f.id || i} className={`mem-fact-row ${f.status === 'stale' ? 'stale' : ''}`}>
                      <input className="mem-input" value={f.text} onChange={(e) => setCardSel({ ...cardSel, facts: cardSel.facts.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
                      <button className="mem-echo-btn" onClick={() => setCardSel({ ...cardSel, facts: cardSel.facts.map((x, j) => j === i ? { ...x, status: x.status === 'stale' ? 'live' : 'stale' } : x) })}>{f.status === 'stale' ? '恢复' : '划掉'}</button>
                      <button className="mem-echo-btn danger" onClick={() => setCardSel({ ...cardSel, facts: cardSel.facts.filter((_, j) => j !== i) })}>删</button>
                    </div>
                  ))}
                  <button className="mem-echo-btn" onClick={() => setCardSel({ ...cardSel, facts: [...cardSel.facts, { text: '', date: new Date().toISOString().slice(0, 10), status: 'live', by: 'her' }] })}>＋ 补一条事实</button>
                  <div className="mem-echo-btns mem-card-actions">
                    <button disabled={cardBusy} className="mem-echo-btn on" onClick={saveCard}>保存</button>
                    <button disabled={cardBusy} className="mem-echo-btn danger" onClick={async () => { if (confirm('删掉整张卡?')) { await cardPost('/api/cards/update', { id: cardSel.id, remove: true }); setCardSel(null) } }}>删掉这张卡</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 条目修正弹层 */}
          {echoSel && (
            <div className="sheet-mask" onClick={() => setEchoSel(null)}>
              <div className="sheet thought" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle" />
                <div className="thought-body mem-detail">
                  <div className="mem-detail-meta">{echoSel.date}{echoSel.event ? ` · ${echoSel.event}` : ''} · 被想起{echoSel.act || 0}次</div>
                  <textarea className="mem-input mem-textarea" defaultValue={echoSel.text} onChange={(e) => setEchoEditText(e.target.value)} rows={4} />
                  <div className="mem-echo-btns">
                    <button disabled={echoBusy || !echoEditText.trim() || echoEditText === echoSel.text} className="mem-echo-btn on" onClick={() => echoEdit({ text: echoEditText })}>保存文字</button>
                    <button disabled={echoBusy} className="mem-echo-btn danger" onClick={() => { if (confirm('删掉这条记忆?')) echoEdit({ remove: true }) }}>删掉</button>
                  </div>
                  <div className="mem-echo-acts">
                    <div className="mem-echo-acts-t">状态</div>
                    <div className="mem-echo-btns">
                      {Object.entries(ECHO_ST).map(([k, v]) => (
                        <button key={k} disabled={echoBusy}
                          className={`mem-echo-btn ${echoSel.status === k ? 'on' : ''}`}
                          onClick={() => echoUpdate({ status: k })}>{v.label}</button>
                      ))}
                    </div>
                    <div className="mem-echo-acts-t">留存</div>
                    <div className="mem-echo-btns">
                      <button disabled={echoBusy} className={`mem-echo-btn ${echoSel.decayClass === 'normal' ? 'on' : ''}`} onClick={() => echoUpdate({ decayClass: 'normal' })}>自然来去</button>
                      <button disabled={echoBusy} className={`mem-echo-btn ${echoSel.decayClass === 'slow' ? 'on' : ''}`} onClick={() => echoUpdate({ decayClass: 'slow' })}>🌿 慢忘</button>
                      <button disabled={echoBusy} className={`mem-echo-btn ${echoSel.decayClass === 'none' ? 'on' : ''}`} onClick={() => echoUpdate({ decayClass: 'none' })}>📌 钉住</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : needsPassword ? (
        <div className="mem-setup glass2">
          <div className="serif mem-setup-t">还没连上记忆库</div>
          <div className="mem-setup-s">去 Settings 里填一次面板密码就好。</div>
          <button className="mem-setup-btn" onClick={goSettings}>去 Settings</button>
        </div>
      ) : (
        <>
          <div className="mem-status">
            {status?.available
              ? `${status.total} memories · 固化${status.permanent} 动态${status.dynamic} 归档${status.archived}`
              : 'Ombre 在睡觉,记忆都还安全'}
          </div>

          {/* 记忆 / 信 / 锚点 */}
          <div className="mem-sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                className={`mem-section ${section === s.key ? 'on' : ''}`}
                onClick={() => setSection(s.key)}
              >
                <span className="mem-section-cn">{s.label}</span>
                <span className="mem-section-en serif">{s.en}</span>
              </button>
            ))}
          </div>

          {/* ---- 记忆 ---- */}
          {section === 'buckets' && (
            <>
              <input
                className="mem-search glass1"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search memories…"
              />
              <div className="mem-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`mem-chip ${filter === f.key ? 'on' : ''}`}
                    onClick={() => setFilter(f.key)}
                  >{f.label}</button>
                ))}
              </div>
              <div className="mem-sortrow">
                <span>⏱</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span className="mem-sort-hint">
                  {sort === 'score' ? '按综合衰减分排列' : ''}
                </span>
              </div>

              <div className="mem-list">
                {loading && <div className="mem-empty serif">remembering…</div>}
                {!loading && error && (
                  <div className="mem-empty serif">
                    Ombre is sleeping.<br />
                    <button className="mem-retry" onClick={load}>retry</button>
                  </div>
                )}
                {!loading && !error && filter === 'archived' && (
                  <div className="mem-empty serif">
                    {status?.archived || 0} 条在归档区安睡。<br />
                    <span className="mem-empty-sub">面板还没把它们的门打开,去 myo 看</span>
                  </div>
                )}
                {!loading && !error && filter !== 'archived' && shown.length === 0 && (
                  <div className="mem-empty serif">
                    {debounced ? 'nothing surfaced.' : 'nothing here.'}
                  </div>
                )}
                {!loading && filter !== 'archived' && shown.map((m) => (
                  <button key={m.id} className="mem-card glass2" onClick={() => openDetail(m)}>
                    <div className="mem-card-top">
                      <span className={`mem-type ${m.type}`}>{m.type}</span>
                      {m.pinned && <span className="mem-pin">📌</span>}
                      {m.firstOfKind && <span className="mem-pin">✨</span>}
                      {m.score != null && <span className="mem-score">{Math.round(m.score)}</span>}
                      <span className="mem-time">{fmtTime(m.lastActiveAt || m.createdAt)}</span>
                    </div>
                    <div className="mem-name">{m.name}</div>
                    <div className="mem-preview">{m.contentPreview || '(empty)'}</div>
                    <div className="mem-foot">
                      <span className="mem-imp">
                        {'●'.repeat(Math.max(0, Math.min(10, m.importance)))}
                        {'○'.repeat(Math.max(0, 10 - m.importance))}
                      </span>
                      <span className="mem-tags">
                        {[...(m.domains || []), ...(m.tags || [])].slice(0, 3).map((t, i) => (
                          <i key={i}>{t}</i>
                        ))}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ---- 信 ---- */}
          {section === 'letters' && (
            <div className="mem-list" style={{ paddingTop: 8 }}>
              {letters.length === 0 && <div className="mem-empty serif">no letters yet.</div>}
              {letters.map((l) => (
                <button
                  key={l.id}
                  className="mem-card glass2 mem-letter"
                  onClick={() => setSelected({ kind: 'letter', name: l.title || '(无题的信)', content: l.content, meta: `${l.author} → ${l.user_name || ''} · ${l.date || (l.created || '').slice(0, 10)}` })}
                >
                  <div className="mem-card-top">
                    <span className="mem-type">💌 {l.author}</span>
                    <span className="mem-time">{l.date || (l.created || '').slice(0, 10)}</span>
                  </div>
                  <div className="mem-name serif">{l.title || '(无题的信)'}</div>
                  <div className="mem-preview">{(l.content || '').slice(0, 80)}</div>
                </button>
              ))}
            </div>
          )}

          {/* ---- 锚点 ---- */}
          {section === 'anchors' && (
            <div className="mem-list" style={{ paddingTop: 8 }}>
              <div className="mem-status">
                坐标系 {anchors?.count ?? 0} / {anchors?.limit ?? 24} —— 定义我们是谁的柱子
              </div>
              {(anchors?.anchors || []).map((a) => (
                <button key={a.id} className="mem-card glass2" onClick={() => openDetail({ id: a.id, kind: 'anchor' })}>
                  <div className="mem-card-top">
                    <span className="mem-type permanent">⚓ anchor</span>
                    <span className="mem-time">{(a.created || '').slice(0, 10)}</span>
                  </div>
                  <div className="mem-name">{a.name}</div>
                  <div className="mem-foot">
                    <span />
                    <span className="mem-tags">
                      {[...(a.domain || []), ...(a.tags || [])].slice(0, 4).map((t, i) => (
                        <i key={i}>{t}</i>
                      ))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* 详情弹层 */}
      {selected && (
        <div className="sheet-mask" onClick={() => setSelected(null)}>
          <div className="sheet thought" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="thought-head">
              <button className="thought-x" onClick={() => setSelected(null)}>×</button>
              <div className="thought-title">{selected.name || 'Untitled'}</div>
              <div style={{ width: 34 }} />
            </div>
            <div className="thought-body mem-detail">
              <div className="mem-detail-meta">
                {selected.kind === 'letter'
                  ? selected.meta
                  : [selected.type, selected.pinned && 'pinned', selected.resolved && 'resolved', selected.digested && 'digested']
                      .filter(Boolean).join(' · ')}
              </div>
              <div className="mem-detail-content">
                {detailLoading ? 'opening memory…' : (selected.content || '(empty)')}
              </div>
              {selected.kind !== 'letter' && !detailLoading && (
                <>
                  <div className="mem-detail-info">
                    <div><span>importance</span><span>{selected.importance}/10</span></div>
                    {selected.score != null && <div><span>综合分</span><span>{Math.round(selected.score)}</span></div>}
                    <div><span>被想起</span><span>{selected.activationCount || 0} 次</span></div>
                    <div><span>创建于</span><span>{fmtTime(selected.createdAt) || '—'}</span></div>
                    <div><span>最近想起</span><span>{fmtTime(selected.lastActiveAt) || '—'}</span></div>
                    {selected.valence != null && <div><span>valence</span><span>{selected.valence}</span></div>}
                    {selected.arousal != null && <div><span>arousal</span><span>{selected.arousal}</span></div>}
                  </div>
                  {selected.whyRemembered && (
                    <div className="mem-why">
                      <span>为什么记得</span>
                      {selected.whyRemembered}
                    </div>
                  )}
                  <button
                    className="mem-id"
                    onClick={() => { navigator.clipboard?.writeText(selected.id || '') }}
                  >id: {selected.id} · 点击复制</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
