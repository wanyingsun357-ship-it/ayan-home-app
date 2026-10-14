import { useEffect, useRef, useState } from 'react'
import { toolInfo, parseTimeline } from '../utils/thoughtTimeline.js'
import ThoughtTimeline from '../components/ThoughtTimeline.jsx'
import './footprints.css'

const kinds = { wander: ['✧', '自发醒来'], alarm: ['◷', '赴一个约定'], fingertips: ['☾', '来看看你'], legacy: ['♡', '历史主动消息'] }
const activityIcons={heart:'♡',book:'▤',list:'☷',file:'▧',image:'▧',search:'⌕',globe:'◎',terminal:'›_',chat:'♧',voice:'◷',tool:'✧'}
const statuses = { queued:'正在排队',scheduled:'等约定的时间', running: '正在活动', completed: '这一轮已结束', quiet: '安静地来过', failed: '这次未完成', timeout: '等待超时', interrupted: '记录中断', legacy: '从聊天记录收录' }
export default function Footprints({ back }) {
  const [session, setSession] = useState(''), [sessions, setSessions] = useState([])
  const [items, setItems] = useState([]), [next, setNext] = useState(null)
  const [busy, setBusy] = useState(true), [error, setError] = useState('')
  const seq = useRef(0)
  async function load(offset = 0) {
    const id = ++seq.current; setBusy(true); setError('')
    try {
      const r = await fetch(`/api/footprints?session=${encodeURIComponent(session)}&offset=${offset}`)
      if (!r.ok) throw Error('足迹暂时没取回来，稍后再试试。')
      const d = await r.json(); if (id !== seq.current) return
      setSessions(d.sessions || []); setItems(old => offset ? [...old, ...d.items] : d.items); setNext(d.nextOffset)
    } catch (e) { if (id === seq.current) setError(e.message) }
    finally { if (id === seq.current) setBusy(false) }
  }
  useEffect(() => { setItems([]); setNext(null); load(); return () => { seq.current++ } }, [session])
  useEffect(() => { const t=setInterval(() => { if(!document.hidden && items.length<=20 && items.some(x=>['running','queued','scheduled'].includes(x.status)))load() },15000);return () => clearInterval(t) },[session,items])
  const day = at => new Date(at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  const time = at => new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return <section className="footprints">
    <header className="fp-head"><button className="fp-back" onClick={back} aria-label="返回">‹</button><div><h1 className="serif">Footprints</h1><p>你不在的时候，也有日子轻轻走过。</p></div><button className="fp-refresh" onClick={() => load()} disabled={busy} aria-label="刷新足迹">↻</button></header>
    <nav className="fp-homes" aria-label="选择家"><button className={!session ? 'on' : ''} onClick={() => setSession('')}>全部</button>{sessions.map(s => <button key={s.id} className={session === s.id ? 'on' : ''} onClick={() => setSession(s.id)}>{s.title}</button>)}</nav>
    <div className="fp-content">
      {error && <div className="fp-empty" role="alert">{error}<button onClick={() => load()}>重试</button></div>}
      {!busy && !error && !items.length && <div className="fp-empty">这里还没有留下足迹。<small>下一次醒来，会从这里开始记录。</small></div>}
      {items.map((item, i) => { const kind = kinds[item.kind] || kinds.alarm; const activities=item.activities?.length?item.activities:parseTimeline(item.reasoning).filter(e=>e.kind==='tool').map((e,n)=>({id:n,detail:e.text,status:'recorded'})); return <div key={item.id}>
        {(i === 0 || day(items[i - 1].at) !== day(item.at)) && <div className="fp-day">{day(item.at)}<span /></div>}
        <article className="fp-card glass1">
          <div className="fp-card-head"><span className="fp-symbol" aria-hidden="true">{kind[0]}</span><div><h2>{kind[1]}</h2><span className="fp-home">{sessions.find(s => s.id === item.session)?.title || '家'}</span></div><time dateTime={item.at}>{time(item.at)}</time></div>
          {item.status==='quiet' && <p className="fp-muted">选择了 [QUIET]，这次不发聊天消息。做过的事仍会留在下面。</p>}
          {item.status==='queued' && <p className="fp-muted">唤醒请求已收到。等待当前活动结束或同一个家 30 分钟的间隔；每天最多执行 6 次。</p>}
          {item.status==='scheduled' && <p className="fp-muted">闹钟已安排，到约定的时间再醒来。</p>}
          {item.error && <p className="fp-error">{item.error}</p>}
          {!!activities.length && <div className="fp-activities">{activities.map(a=>{const info=toolInfo(a.detail);return <details className="fp-activity" key={a.id}><summary><span className="fp-activity-icon" aria-hidden="true">{activityIcons[info.icon]||'✧'}</span><span><strong>{info.label}</strong>{(a.titles?.length||info.target)&&<small>{a.titles?.map(t=>'《'+t+'》').join('、')||info.target}</small>}</span><em>{a.status==='running'?'进行中':a.status==='failed'?'未完成':a.status==='completed'?'调用完成':'已调用'}</em></summary><pre>{a.detail}</pre></details>})}</div>}
          {item.reason && <p className="fp-reason">{item.reason}</p>}
          {item.text && <details className="fp-message"><summary>{item.text.replace(/\[\/?VOICE\]/g, '').slice(0,160)}{item.text.length > 160 ? '…' : ''}</summary><p>{item.text.replace(/\[\/?VOICE\]/g, '')}</p></details>}
          {item.reasoning && <details className="fp-trace"><summary>看看这次的活动<span>⌄</span></summary><ThoughtTimeline text={item.reasoning} /></details>}
          {!item.text && !item.reasoning && !activities.length && !['quiet','queued','scheduled'].includes(item.status) && <p className="fp-muted">{item.status === 'running' ? '等他留下这一轮的记录。' : '这次没有留下更多活动细节。'}</p>}
          <footer><i className={item.status} />{statuses[item.status] || '已记录'}</footer>
        </article>
      </div> })}
      {busy && <p className="fp-empty" role="status">正在拾起足迹…</p>}
      {next != null && !busy && <button className="fp-more" onClick={() => load(next)}>再往前看看</button>}
      <p className="fp-note">记录已发生的唤醒与主动消息。较早的安静活动可能没有留下记录。</p>
    </div>
  </section>
}
