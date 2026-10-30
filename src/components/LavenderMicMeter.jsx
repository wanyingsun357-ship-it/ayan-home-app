import { useEffect, useRef } from 'react'

// A display-only branch of the existing microphone stream. Never owns its tracks.
export default function LavenderMicMeter({ stream, context }) {
  const root = useRef(null)
  useEffect(() => {
    if (!stream || !context || context.state === 'closed') return
    let source, analyser, timer, stopped = false
    const reset = () => root.current?.style.setProperty('--mic-level', '0')
    try {
      source = context.createMediaStreamSource(stream)
      analyser = context.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
    } catch { source?.disconnect(); return }
    const samples = new Float32Array(analyser.fftSize)
    const tick = () => {
      clearTimeout(timer)
      if (stopped || document.hidden || context.state === 'closed') { reset(); return }
      analyser.getFloatTimeDomainData(samples)
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
      root.current?.style.setProperty('--mic-level', String(Math.min(1, rms * 8)))
      timer = setTimeout(tick, 80)
    }
    document.addEventListener('visibilitychange', tick)
    tick()
    return () => {
      stopped = true; clearTimeout(timer)
      document.removeEventListener('visibilitychange', tick)
      source.disconnect(); analyser.disconnect(); reset()
    }
  }, [stream, context])
  return <span ref={root} className="lavender-mic-meter" aria-hidden="true">{[.45,.75,1,.75,.45].map((weight, i) => <i key={i} style={{ '--bar-weight': weight }} />)}</span>
}
