import { useEffect, useState } from 'react'
import './engine.css'
import { requestEnginePair } from '../utils/engineAccess.js'
export default function EngineUsage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const load = async () => {
    try { const r = await fetch('/api/engine'); if (!r.ok) throw new Error(); setData(await r.json()); setError(false) } catch { setError(true) }
  }
  useEffect(() => { load() }, [])
  const windows = [['primary', '当前额度'], ['secondary', '较长周期额度']]
  return <div className="set-group engine-usage">
    <div className="set-group-name">Codex · {data?.codex?.plan?.toUpperCase() || 'ChatGPT'}</div>
    <div className="set-row"><span>当前后端</span><span>{data?.engine === 'codex' ? 'Codex' : 'Claude · OpenRouter'}</span></div>
    <div className="set-hint">{data?.codex?.ready ? '已登录 · 与这个账号的其他 Codex 使用共享额度' : '等待 VPS 完成 ChatGPT 授权'}</div>
    {data?.codex?.ready && !data.paired && <button className="sheet-item" onClick={async () => {
      if (await requestEnginePair()) load()
    }}>连接这台设备以查看额度</button>}
    {data?.paired && windows.map(([key, label]) => {
      const w = data.codex?.limits?.[key]
      if (!w) return null
      const left = Math.max(0, Math.min(100, 100 - w.usedPercent))
      return <div className="engine-window" key={key}>
        <div className="set-row"><span>{label}{w.windowDurationMins ? ` · ${w.windowDurationMins >= 1440 ? `${Math.round(w.windowDurationMins / 1440)} 天` : w.windowDurationMins >= 60 ? `${w.windowDurationMins / 60} 小时` : `${w.windowDurationMins} 分钟`}` : ''}</span><span>剩余 {Math.round(left)}%</span></div>
        <div className="engine-meter"><i style={{ width: `${left}%` }} /></div>
        {w.resetsAt && <div className="set-hint">重置于 {new Date(w.resetsAt * 1000).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
      </div>
    })}
    {data?.paired && data.codex?.ready && !data.codex.limits && <div className="set-hint">暂时没有返回额度明细。</div>}
    {error && <div className="set-hint">暂时无法读取，保留上次数据。</div>}
    <button className="sheet-item" onClick={load}>刷新状态</button>
  </div>
}
