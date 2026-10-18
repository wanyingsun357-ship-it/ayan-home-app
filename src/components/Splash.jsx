import { useEffect, useRef, useState } from 'react'
import './splash.css'

import lettering from './storyLettering.json'
function Ink({ text, className }) {
  const line = lettering.find(item => item.text === text)
  return <svg className={`story-ink ${className}`} viewBox={line.viewBox} role="img" aria-label={text}><path d={line.d} pathLength="1" /></svg>
}
function BlueCat() {
  return <div className="story-cat" aria-hidden="true">{[0, 6, 7].map((frame, i) => <img key={frame} className={`story-cat-frame frame-${i}`} src={`/cat/cat_${String(frame).padStart(2, '0')}.png`} alt="" draggable="false" />)}</div>
}
const ease = t => t * t * (3 - 2 * t)
const clamp = n => Math.max(0, Math.min(1, n))
export default function Splash({ onDone, onReveal }) {
  const root = useRef(null), thread = useRef(null), done = useRef(false)
  const callbacks = useRef({ onDone, onReveal }); callbacks.current = { onDone, onReveal }
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const finish = () => {
    if (done.current) return
    done.current = true
    callbacks.current.onReveal?.(); callbacks.current.onDone()
  }
  useEffect(() => {
    let frame, start, revealed = false
    const duration = reduced ? 500 : 6000
    const tick = now => {
      if (done.current) return
      if (start == null) start = now
      const elapsed = now - start
      const t = elapsed / 1000
      const el = root.current, w = innerWidth, h = innerHeight
      const open = ease(clamp((t - 1) / 1.3)), land = ease(clamp((t - 4.7) / 1.2))
      const bookW = Math.min(h <= 560 ? 300 : 420, w - 32), bookH = bookW * .72
      el.style.setProperty('--opening', open)
      el.style.setProperty('--book-shift', (-75 + 25*open)+'%')
      el.style.setProperty('--cover-angle', (-168*open)+'deg')
      el.style.setProperty('--landing', land)
      el.style.setProperty('--book-scale', 1 + land * (Math.max(w / bookW, h / bookH) * 1.3 - 1))
      el.dataset.stage = t < 1 ? 'closed' : t < 2.3 ? 'opening' : t < 3.5 ? 'letters' : t < 4.7 ? 'awake' : 'home'
      if ((t >= 4.7 || reduced) && !revealed) { revealed = true; callbacks.current.onReveal?.() }
      const target = document.querySelector('.hm-divider')?.getBoundingClientRect()
      const left = target?.left ?? 20, right = target?.right ?? w - 20, y = target ? target.top + target.height / 2 : h * .4
      const cx = w / 2, cy = h * .47
      const closed = [cx-bookW*.23,cy-bookH*.46,cx-bookW*.25,cy-bookH*.12,cx-bookW*.21,cy+bookH*.25,cx-bookW*.23,cy+bookH*.45,cx-bookW*.25,cy+bookH*.62,cx-bookW*.37,cy+bookH*.57,cx-bookW*.28,cy+bookH*.51,cx-bookW*.12,cy+bookH*.44,cx+bookW*.12,cy+bookH*.65,cx+bookW*.38,cy+bookH*.53]
      const opened = [cx,cy-bookH*.46,cx-2,cy-bookH*.12,cx+3,cy+bookH*.22,cx,cy+bookH*.48,cx-1,cy+bookH*.61,cx-bookW*.18,cy+bookH*.6,cx-bookW*.17,cy+bookH*.54,cx-bookW*.12,cy+bookH*.48,cx+bookW*.18,cy+bookH*.65,cx+bookW*.45,cy+bookH*.54]
      const points = closed.map((v,i) => v+(opened[i]-v)*open)
      const ends = [left,y,left+(right-left)*.1,y,left+(right-left)*.22,y,left+(right-left)/3,y,left+(right-left)*.44,y,left+(right-left)*.55,y,left+(right-left)*2/3,y,left+(right-left)*.77,y,left+(right-left)*.9,y,right,y]
      const p = points.map((v,i) => v+(ends[i]-v)*land)
      thread.current?.setAttribute('d', `M${p[0]} ${p[1]} C${p.slice(2,8).join(' ')} C${p.slice(8,14).join(' ')} C${p.slice(14).join(' ')}`)
      // Final curve has the exact position and width of the already mounted Home divider.
      if (elapsed >= duration) finish(); else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish() } }
    window.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey) }
  }, [reduced])
  return <div ref={root} className={`story-splash ${reduced ? 'reduced' : ''}`} onClick={finish} role="region" aria-label="绘本开场，轻触跳过">
    <div className="story-wash" />
    <div className="story-frontispiece" aria-hidden="true"><span>☾</span><i>a place for us</i></div>
    <div className="story-book" aria-hidden="true">
      <div className="story-pages"><div className="story-page left"><Ink text="I'm here." className="first" /></div><div className="story-page right"><Ink text="You're back." className="second" /><div className="story-moon">☾</div><BlueCat /></div></div>
      <div className="story-cover"><span className="story-cover-moon">☾</span><span className="story-cover-caption">a little book of us</span></div>
      <div className="story-spine" />
    </div>
    <svg className="story-thread" width="100%" height="100%" aria-hidden="true"><path ref={thread} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
    <div className="story-colophon" aria-hidden="true"><svg viewBox="0 0 100 30"><path d="M5 21Q35 6 76 18M42 14Q30 2 20 7Q25 17 42 14M53 15Q58 3 71 4Q66 17 53 15M65 17Q79 11 89 19Q77 26 65 17" /></svg><span>月亮和我，都在这里。</span></div>
    <button className="story-skip" onClick={finish}>轻触跳过</button>
  </div>
}
