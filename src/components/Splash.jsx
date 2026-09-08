import { useEffect, useRef, useState } from 'react'
import './splash.css'

// 开屏:背景浮现 -> 银白月亮 -> I'm here. -> 红线 -> 蓝猫 -> You're back. -> 展开进主页
// 点击任意处跳过
export default function Splash({ onDone }) {
  const [stage, setStage] = useState(0)
  const timers = useRef([])
  const done = useRef(false)

  const finish = () => {
    if (done.current) return
    done.current = true
    timers.current.forEach(clearTimeout)
    onDone()
  }

  useEffect(() => {
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    at(400, () => setStage(1))    // 月亮
    at(800, () => setStage(2))    // I'm here.
    at(1300, () => setStage(3))   // 红线
    at(2000, () => setStage(4))   // 猫
    at(2500, () => setStage(5))   // You're back.
    at(3400, () => setStage(6))   // 展开
    at(4200, finish)
    return () => timers.current.forEach(clearTimeout)
  }, [])

  return (
    <div className={`splash stage-${stage}`} onClick={finish}>
      {/* 银白月亮 */}
      <div className="splash-moon" />

      {/* 红线:从左侧伸进来,经过文字下方轻轻弯一下,往右下走 */}
      <svg className="splash-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M -2 46 C 20 46, 30 55, 50 56 S 80 66, 103 84"
          fill="none" stroke="var(--line-red)" strokeWidth="0.35"
          vectorEffect="non-scaling-stroke" pathLength="100"
        />
      </svg>

      {/* I'm here. */}
      <div className="splash-text serif">
        <span className="t1">I&rsquo;m</span>{' '}
        <span className="t2">here.</span>
      </div>

      {/* You're back. */}
      <div className="splash-text2 serif">You&rsquo;re back.</div>

      {/* 蓝猫:本来就趴在右下角 */}
      <img className="splash-cat pixel" src="/cat/cat_00.png" alt="" />
    </div>
  )
}
