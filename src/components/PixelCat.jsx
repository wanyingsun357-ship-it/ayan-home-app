import { useEffect, useRef, useState } from 'react'

// 蓝猫:趴着想事情,偶尔摇尾巴。
// 点一下 -> 翻肚皮(只给看一次);再点 -> 翻回来装没事;
// 之后再点 -> 坐起来睁眼看你一会儿。
const F = (i) => `/cat/cat_${String(i).padStart(2, '0')}.png`
const TAIL_SWAY = [1, 2, 3, 4, 5, 4, 3, 2, 1, 0]
const FLIP = [6, 7, 8, 9, 10, 11]
const UNROLL = [12, 13, 14]
const SIT_UP = [15, 16, 17]

export default function PixelCat({ size = 96, style = {} }) {
  const [frame, setFrame] = useState(0)
  const [fading, setFading] = useState(false)
  const st = useRef({ mode: 'idle', shownBelly: false, timer: null, sway: null, sit: null })

  const playSeq = (frames, ms, done) => {
    const s = st.current
    s.mode = 'busy'
    clearInterval(s.timer)
    let i = 0
    s.timer = setInterval(() => {
      setFrame(frames[i++])
      if (i >= frames.length) { clearInterval(s.timer); done && done() }
    }, ms)
  }

  const scheduleSway = () => {
    const s = st.current
    clearTimeout(s.sway)
    s.sway = setTimeout(() => {
      if (s.mode === 'idle') playSeq(TAIL_SWAY, 140, () => { s.mode = 'idle'; scheduleSway() })
    }, 4000 + Math.random() * 6000)
  }

  const fadeToIdle = () => {
    const s = st.current
    setFading(true)
    setTimeout(() => {
      setFrame(0); s.mode = 'idle'; setFading(false); scheduleSway()
    }, 160)
  }

  const onClick = (e) => {
    e.stopPropagation()
    const s = st.current
    if (s.mode === 'idle') {
      clearTimeout(s.sway)
      if (!s.shownBelly) {
        s.shownBelly = true
        playSeq(FLIP, 150, () => { s.mode = 'back' })
      } else {
        playSeq(SIT_UP, 160, () => {
          s.mode = 'sitting'
          s.sit = setTimeout(fadeToIdle, 1600)
        })
      }
    } else if (s.mode === 'back') {
      playSeq(UNROLL, 150, () => { setFrame(0); s.mode = 'idle'; scheduleSway() })
    } else if (s.mode === 'sitting') {
      clearTimeout(s.sit)
      fadeToIdle()
    }
  }

  useEffect(() => {
    // 预加载全部帧
    for (let i = 0; i < 18; i++) { const img = new Image(); img.src = F(i) }
    scheduleSway()
    const s = st.current
    return () => { clearInterval(s.timer); clearTimeout(s.sway); clearTimeout(s.sit) }
  }, [])

  return (
    <img
      className="pixel"
      src={F(frame)}
      alt=""
      onClick={onClick}
      style={{
        width: size, height: size, cursor: 'pointer',
        opacity: fading ? 0 : 1, transition: 'opacity .15s',
        ...style,
      }}
    />
  )
}
