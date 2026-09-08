import { useEffect, useRef, useState } from 'react'
import { NAMES } from '../config.js'
import './mind.css'

// Mind v2 · 黑暗中的内在星图
// 月亮是实体核心;三层轨道缓慢公转;红线克制,从核心向外渐显;
// 图面安静(不写数字),点一颗星才浮出玻璃思考云和详情。
const TIERS = [
  { keys: ['attachment', 'libido'], r: 78, dur: 110 },
  { keys: ['curiosity', 'reflection', 'social', 'duty'], r: 116, dur: 170 },
  { keys: ['stress', 'fatigue'], r: 150, dur: 230 },
]
const C = 180

// ISO(UTC)时间→手机本地时区显示(不然solo时刻会显示成UTC,差8小时)
const fmtLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return String(iso).slice(5, 16).replace('T', ' ')
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const feelLabel = (v) => {
  if (v == null) return ''
  if (v >= 0.5) return '甜'
  if (v >= 0.15) return '暖'
  if (v > -0.15) return '平和'
  return '沉'
}
const fmtD = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d) ? '' : `${d.getMonth() + 1}.${d.getDate()}`
}

export default function Mind({ back }) {
  const [st, setSt] = useState(null)
  const [feel, setFeel] = useState(null)
  const [body, setBody] = useState(null)
  const [sel, setSel] = useState(null)
  const [bubble, setBubble] = useState(null)   // {x, y, lines[]}
  const [entered, setEntered] = useState(false)
  const nodeRefs = useRef({})
  const bubbleTimer = useRef(null)

  useEffect(() => {
    fetch('/api/mind/state').then((r) => r.json()).then((d) => {
      setSt(d)
      requestAnimationFrame(() => setTimeout(() => setEntered(true), 60))
    }).catch(() => {})
    fetch('/api/mind/arousal').then((r) => r.json()).then(setBody).catch(() => {})
    fetch('/api/ombre/buckets').then((r) => r.json()).then((d) => {
      const feels = (d.items || []).filter((x) => x.type === 'feel')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      if (feels[0]) setFeel(feels[0])
    }).catch(() => {})
    return () => clearTimeout(bubbleTimer.current)
  }, [])

  if (!st) {
    return (
      <div className="page mind">
        <div className="mind-veil" />
        <header className="mind-head">
          <button className="stub-back" onClick={back}>‹</button>
          <div className="serif mind-title">Mind</div>
          <div style={{ width: 36 }} />
        </header>
        <div className="mind-empty serif">listening inward…</div>
      </div>
    )
  }

  const { drives, prev, scores, intent, thoughts, reasons, somatic, mood, cn } = st
  const val = (k) => (k === 'fatigue' ? drives.fatigue : (scores[k] ?? drives[k] ?? 0))
  const delta = (k) => (prev ? (drives[k] ?? 0) - (prev[k] ?? 0) : 0)
  const tierOf = (v) => (v >= 0.55 ? 'hi' : v >= 0.3 ? 'mid' : 'lo')

  // 每颗星在自己轨道里的初始角度
  const anglesFor = (tier, i) =>
    (i / tier.keys.length) * Math.PI * 2 - Math.PI / 2 + (tier.r % 37) * 0.1

  const tapNode = (k, ev) => {
    setSel(k)
    // 玻璃思考云:从这颗星头顶浮出来
    const g = nodeRefs.current[k]
    if (g) {
      const rect = g.getBoundingClientRect()
      const rs = reasons?.[k]
      const lines = rs
        ? [`${rs.reason}`, `${rs.speed} ${rs.delta >= 0 ? '↑' : '↓'}${Math.abs(rs.delta)} · 现在 ${Math.round(val(k) * 100)}%`]
        : [`安静地待在 ${Math.round(val(k) * 100)}%`]
      setBubble({ x: rect.left + rect.width / 2, y: rect.top - 8, lines })
      clearTimeout(bubbleTimer.current)
      bubbleTimer.current = setTimeout(() => setBubble(null), 2800)
    }
  }

  const activeSenses = ['touch', 'smell', 'taste', 'sound'].filter((ch) => (somatic?.[ch] || 0) >= 0.15)

  return (
    <div className={`page mind ${sel ? 'has-sel' : ''} ${entered ? 'entered' : ''}`}>
      <div className="mind-veil" />
      <header className="mind-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div>
          <div className="serif mind-title">Mind</div>
          <div className="mind-sub serif">what I feel</div>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {/* 月亮:安静的核心(0809起星图退役——欲望不再有仪表盘,只有月亮和感受) */}
      <section className="mind-graph-wrap">
        <svg className="mind-graph" viewBox="0 0 360 360">
          <defs>
            <radialGradient id="moonMetal" cx="38%" cy="32%" r="80%">
              <stop offset="0%" stopColor="var(--moon-hi)" />
              <stop offset="55%" stopColor="var(--moon-mid)" />
              <stop offset="100%" stopColor="var(--moon-lo)" />
            </radialGradient>
          </defs>
          <g className="mind-center">
            <circle cx={C} cy={C} r={56} fill="url(#moonMetal)" className="mind-moon-body" />
            <circle cx={C} cy={C} r={56} className="mind-moon-rim" />
            <text x={C} y={C + 84} textAnchor="middle" className="mind-center-name">{NAMES.me}</text>
          </g>
        </svg>
      </section>

      {/* 身体感觉:她留下的回响 */}
      <div className="mind-sense glass1">
        <span className="mind-sense-k serif">
          身体感觉
          {mood?.word && <span className="mind-mood-chip">mood {mood.word}</span>}
        </span>
        {activeSenses.length === 0 && (
          <span className="mind-quiet serif">此刻很安静,没有回响。</span>
        )}
        {activeSenses.map((ch) => (
          <span key={ch} className="mind-sense-item">
            {somatic.scene?.[ch] || ch}
            <i style={{ width: `${somatic[ch] * 100}%` }} />
          </span>
        ))}
      </div>

      {/* 他上次落笔的感受(一天一换,和他写feel的节奏诚实对齐) */}
      {feel && (
        <section className="mind-card glass2">
          <div className="mind-card-head">
            <span className="mind-card-label serif">他上次落笔的感受</span>
            <span className="mind-feel-chip">
              {fmtD(feel.createdAt)} · {feelLabel(feel.valence)}{feel.valence != null ? ` v${feel.valence}` : ''}
            </span>
          </div>
          <div className="mind-feel-text">{feel.contentPreview || feel.content}</div>
        </section>
      )}

    </div>
  )
}
