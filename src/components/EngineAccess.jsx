import { useEffect, useState } from 'react'
import './engine.css'
export default function EngineAccess() {
  const [request, setRequest] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const listener = e => { setRequest(e.detail); setCode(''); setError('') }
    window.addEventListener('ayan:pair', listener)
    if (window.__ayanPairRequest) listener({ detail: window.__ayanPairRequest })
    return () => window.removeEventListener('ayan:pair', listener)
  }, [])
  if (!request) return null
  const finish = ok => { if (window.__ayanPairRequest === request) delete window.__ayanPairRequest; request.resolve(ok); setRequest(null) }
  const unlock = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await fetch('/api/engine/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '配对失败')
      finish(true)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="sheet-mask engine-pair-mask">
    <form className="sheet engine-pair" onSubmit={unlock}>
      <div className="sheet-handle" />
      <div className="model-sheet-title">连接你的设备</div>
      <p className="set-hint">输入为你生成的一次性配对码。这台设备会记住授权，以后直接打开就能聊。</p>
      <input aria-label="设备配对码" autoFocus autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
      {error && <p role="alert" className="set-hint">{error}</p>}
      <button type="submit" className="sheet-item" disabled={busy || !code.trim()}>{busy ? '连接中…' : '连接设备'}</button>
      <button type="button" className="sheet-item" disabled={busy} onClick={() => finish(false)}>稍后再说</button>
    </form>
  </div>
}
