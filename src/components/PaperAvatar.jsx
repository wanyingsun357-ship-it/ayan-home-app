import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
const SIZE = 260
export default function PaperAvatar({ who = 'him', editable = false }) {
  const key = 'paper-avatar-' + who
  const [src, setSrc] = useState(() => localStorage.getItem(key) || '')
  const [crop, setCrop] = useState(null), [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const input = useRef(null), trigger = useRef(null), cancel = useRef(null), drag = useRef(null), request = useRef(0)
  useEffect(() => {
    const refresh = () => setSrc(localStorage.getItem(key) || '')
    window.addEventListener('paper-avatar', refresh)
    return () => window.removeEventListener('paper-avatar', refresh)
  }, [key])
  useEffect(() => () => { request.current++ }, [])
  useEffect(() => {
    if (!crop) return
    cancel.current?.focus()
    const escape = e => { if (e.key === 'Escape') { e.preventDefault(); setCrop(null); trigger.current?.focus() } }
    window.addEventListener('keydown', escape)
    return () => { URL.revokeObjectURL(crop.url); window.removeEventListener('keydown', escape) }
  }, [crop])
  const scale = crop ? SIZE / Math.min(crop.img.width, crop.img.height) * zoom : 1
  const bounded = (point, z = zoom) => {
    if (!crop) return point
    const s = SIZE / Math.min(crop.img.width, crop.img.height) * z
    const x = (crop.img.width * s - SIZE) / 2, y = (crop.img.height * s - SIZE) / 2
    return { x: Math.max(-x, Math.min(x, point.x)), y: Math.max(-y, Math.min(y, point.y)) }
  }
  async function choose(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const ticket = ++request.current, url = URL.createObjectURL(f)
    try {
      const img = new Image(); img.src = url; await img.decode()
      if (ticket !== request.current) { URL.revokeObjectURL(url); return }
      setZoom(1); setOffset({ x: 0, y: 0 }); setCrop({ img, url })
    } catch { URL.revokeObjectURL(url); alert('这张照片未能打开，请换一张重试') }
  }
  function close() { setCrop(null); trigger.current?.focus() }
  function save() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 384
      const side = SIZE / scale
      c.getContext('2d').drawImage(crop.img, (crop.img.width - side) / 2 - offset.x / scale,
        (crop.img.height - side) / 2 - offset.y / scale, side, side, 0, 0, 384, 384)
      localStorage.setItem(key, c.toDataURL('image/jpeg', .9))
      window.dispatchEvent(new Event('paper-avatar')); close()
    } catch { alert('头像未能保存，请重试') }
  }
  const content = src ? <img src={src} alt={who === 'him' ? '晏白头像' : '你的头像'} /> : <span>{who === 'him' ? '☾' : 'Y'}</span>
  return editable ? <>
    <button ref={trigger} className="paper-avatar" title="更换头像（保存在本设备）" aria-label={who === 'him' ? '更换晏白头像' : '更换你的头像'} onClick={() => input.current?.click()}>{content}</button>
    <input ref={input} hidden type="file" accept="image/*" onChange={choose} />
    {crop && createPortal(<div className="avatar-crop-mask" onClick={close}>
      <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby={'crop-title-' + who} onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key !== 'Tab') return; const els = [...e.currentTarget.querySelectorAll('button,input')]; const i = els.indexOf(document.activeElement); if (e.shiftKey && i === 0) { e.preventDefault(); els.at(-1).focus() } else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus() } }}>
        <h2 id={'crop-title-' + who}>裁剪头像</h2><p>拖动照片，调整圆框里的位置</p>
        <div className="avatar-crop-stage" onPointerDown={e => { if(drag.current)return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, offset } }}
          onPointerMove={e => { const d = drag.current; if (!d || d.id !== e.pointerId) return; setOffset(bounded({ x: d.offset.x + e.clientX - d.x, y: d.offset.y + e.clientY - d.y })) }}
          onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
          <img src={crop.url} alt="头像裁剪预览" draggable="false" style={{ width: crop.img.width * scale, height: crop.img.height * scale, transform: `translate(calc(-50% + ${offset.x}px),calc(-50% + ${offset.y}px))` }} />
          <span className="avatar-crop-circle" />
        </div>
        <label className="avatar-crop-zoom">缩放<input aria-label="头像缩放" type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => { const z = Number(e.target.value); setZoom(z); setOffset(bounded(offset, z)) }} /></label>
        <div className="avatar-crop-actions"><button ref={cancel} onClick={close}>取消</button><button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}>重置</button><button className="save" onClick={save}>使用头像</button></div>
      </section>
    </div>, document.body)}
  </> : <span className="paper-avatar">{content}</span>
}
