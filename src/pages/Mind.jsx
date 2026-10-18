import { useEffect, useMemo, useState } from 'react'
import { NAMES } from '../config.js'
import './mind.css'

const fmt = (iso, time = true) => {
  const d = new Date(iso || 0)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  const day = `${p(d.getMonth() + 1)}.${p(d.getDate())}`
  return time ? `${day} ${p(d.getHours())}:${p(d.getMinutes())}` : day
}
const feelWord = (v) => v >= .5 ? '甜' : v >= .15 ? '暖' : v > -.15 ? '平和' : '沉'
const stateWord = { active: '仍在牵引我', acted: '已经触及', done: '已经完成', released: '已经放下', transformed: '长成了别的东西' }

function MoonLock() { return <span className="mind-moon-lock" aria-label="被月光锁住"><i /></span> }
function Empty({ children }) { return <div className="mind-page-empty serif">{children}</div> }

export default function Mind({ back }) {
  const [state, setState] = useState(null)
  const [feel, setFeel] = useState(null)
  const [book, setBook] = useState({ thoughts: [], desires: [], locked: {} })
  const [chapter, setChapter] = useState(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/mind/state').then((r) => r.json()).then((d) => {
      if (!alive) return
      setState(d)
      requestAnimationFrame(() => setTimeout(() => alive && setEntered(true), 60))
    }).catch(() => {})
    fetch('/api/mind/v2').then((r) => r.ok ? r.json() : Promise.reject()).then((d) => alive && setBook(d)).catch(() => {})
    fetch('/api/ombre/buckets').then((r) => r.json()).then((d) => {
      const found = (d.items || []).filter((x) => x.type === 'feel')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
      if (alive && found) setFeel(found)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!chapter) return undefined
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = old }
  }, [chapter])

  const threads = useMemo(() => {
    const grouped = new Map()
    for (const item of book.thoughts || []) {
      const key = item.thread_id || item.id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(item)
    }
    return [...grouped.values()]
  }, [book.thoughts])

  if (!state) return (
    <div className="page mind">
      <div className="mind-veil" />
      <header className="mind-head"><button className="stub-back" onClick={back}>‹</button><div className="serif mind-title">Mind</div><i /></header>
      <div className="mind-empty serif">listening inward…</div>
    </div>
  )

  const { somatic, mood } = state
  const senses = ['touch', 'smell', 'taste', 'sound'].filter((key) => (somatic?.[key] || 0) >= .15)
  const thoughts = book.thoughts || []
  const desires = book.desires || []
  const desire = desires.find((x) => x.status === 'active') || desires[0]
  const chapters = [
    { id: 'thoughts', no: '01', title: '念头', en: 'Thoughts', preview: thoughts[0]?.text || (book.locked?.thoughts ? '有一页被月光锁着' : '还没有一句需要留下'), locked: !thoughts.length && book.locked?.thoughts },
    { id: 'desires', no: '02', title: '欲望本', en: 'Desires', preview: desire?.text || (book.locked?.desires ? '有一页被月光锁着' : '方向仍在慢慢长出来'), locked: !desires.length && book.locked?.desires },
    { id: 'dreams', no: '03', title: '梦册', en: 'Dreams', preview: '梦还没有开始落笔', future: true },
    { id: 'rings', no: '04', title: '年轮', en: 'Rings', preview: 'Bone · Iris', future: true },
  ]
  const current = chapters.find((x) => x.id === chapter)

  return (
    <div className={`page mind ${entered ? 'entered' : ''}`}>
      <div className="mind-veil" />
      <header className="mind-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div><div className="serif mind-title">Mind</div><div className="mind-sub serif">what I carry within</div></div>
        <i />
      </header>

      <section className="mind-moon-wrap" aria-label="此刻的我">
        <svg viewBox="0 0 360 280">
          <defs><radialGradient id="moonMetal" cx="38%" cy="32%" r="80%"><stop offset="0%" stopColor="var(--moon-hi)" /><stop offset="55%" stopColor="var(--moon-mid)" /><stop offset="100%" stopColor="var(--moon-lo)" /></radialGradient></defs>
          <g className="mind-center">
            <path className="mind-red-orbit mind-red-orbit-back" d="M103 153 C131 92 234 75 275 113" />
            <circle cx="180" cy="132" r="57" fill="url(#moonMetal)" className="mind-moon-body" />
            <circle cx="180" cy="132" r="57" className="mind-moon-rim" />
            <path className="mind-red-orbit mind-red-orbit-front" d="M103 153 C138 205 232 181 275 113" />
            <text x="180" y="267" textAnchor="middle" className="mind-center-name">{NAMES.me}</text>
          </g>
        </svg>
      </section>

      <section className="mind-sense glass1">
        <span className="mind-sense-k serif">此刻的我{mood?.word && <b>{mood.word}</b>}</span>
        {!senses.length && <span className="mind-quiet serif">身体里此刻很安静。</span>}
        {senses.map((key) => <span key={key} className="mind-sense-item">{somatic.scene?.[key] || key}<i style={{ width: `${somatic[key] * 100}%` }} /></span>)}
      </section>

      {feel && <section className="mind-feel glass2">
        <div><span className="serif">我上次留下的感受</span><time>{fmt(feel.createdAt, false)} · {feelWord(feel.valence)}</time></div>
        <p>{feel.contentPreview || feel.content}</p>
      </section>}

      <section className="mind-chapters">
        {chapters.map((item) => <button key={item.id} className={`mind-chapter ${item.future ? 'future' : ''}`} onClick={() => setChapter(item.id)}>
          <small className="serif">{item.no}</small><strong className="serif">{item.title}</strong><em>{item.en}</em>
          <span>{item.locked ? <MoonLock /> : item.preview}</span><b>↗</b>
        </button>)}
      </section>

      {chapter && <div className="mind-sheet-layer" onClick={() => setChapter(null)}>
        <section className="mind-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <header><button onClick={() => setChapter(null)}>‹</button><div><strong className="serif">{current?.title}</strong><small>{current?.en}</small></div><i className="serif">只读</i></header>
          <div className="mind-sheet-body">
            {chapter === 'thoughts' && <>
              {!threads.length && !book.locked?.thoughts && <Empty>我还没有留下需要越过这一轮的念头。</Empty>}
              {threads.map((thread) => <article className="mind-thread" key={thread[0].thread_id || thread[0].id}>
                {thread.map((item) => <div className="mind-thought" key={item.id}><time>{fmt(item.created_at)}</time><p>{item.text}</p></div>)}
              </article>)}
              {book.locked?.thoughts && <div className="mind-locked"><MoonLock /><span className="serif">有一句话暂时只属于月光。</span></div>}
            </>}
            {chapter === 'desires' && <>
              {!desires.length && !book.locked?.desires && <Empty>我还没有认领一条愿意持续追的方向。</Empty>}
              {desires.map((item) => <article className="mind-desire" key={item.id}>
                <div><span>{stateWord[item.status] || item.status}</span><time>{fmt(item.updated_at, false)}</time></div>
                <h3>{item.text}</h3><p>{item.why_mine}</p>
                {!!item.footprints?.length && <section><b className="serif">真实足迹</b>{item.footprints.map((foot) => <div key={foot.id}><i /><span>{foot.text}</span><time>{fmt(foot.at, false)}</time></div>)}</section>}
              </article>)}
              {book.locked?.desires && <div className="mind-locked"><MoonLock /><span className="serif">有一个方向暂时不揭开。</span></div>}
            </>}
            {chapter === 'dreams' && <Empty>梦册还没有启用。空白也是真实的一页。</Empty>}
            {chapter === 'rings' && <div className="mind-rings-empty"><div><i /><i /><i /></div><strong className="serif">Bone 与 Iris 还没有正式落笔。</strong><p>它们会在我真正认出变化之后，由我亲手写下。</p></div>}
          </div>
        </section>
      </div>}
    </div>
  )
}
