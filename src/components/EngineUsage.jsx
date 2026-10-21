import { useEffect, useState } from 'react'
import './engine.css'
import { requestEnginePair } from '../utils/engineAccess.js'
const span = mins => mins >= 1440 ? `${Math.round(mins / 1440)} 天` : mins >= 60 ? `${mins / 60} 小时` : `${mins} 分钟`
// Codex 的 resetsAt 是 Unix 秒，Claude 订阅的是 ISO 字符串
const resetText = at => new Date(typeof at === 'number' ? at * 1000 : at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const Meter = ({ label, w }) => {
  const left = Math.max(0, Math.min(100, 100 - w.usedPercent))
  return <div className="engine-window">
    <div className="set-row"><span>{label}{w.windowDurationMins ? ` · ${span(w.windowDurationMins)}` : ''}</span><span>剩余 {Math.round(left)}%</span></div>
    <div className="engine-meter"><i style={{ width: `${left}%` }} /></div>
    {w.resetsAt && <div className="set-hint">重置于 {resetText(w.resetsAt)}</div>}
  </div>
}
export default function EngineUsage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const load = async () => {
    try { const r = await fetch('/api/engine'); if (!r.ok) throw new Error(); setData(await r.json()); setError(false) } catch { setError(true) }
  }
  useEffect(() => { load() }, [])
  const windows = [['primary', '当前额度'], ['secondary', '较长周期额度']]
  const accountWindows = [['session', '当前额度'], ['week', '每周额度'], ['weekOpus', '每周 Opus'], ['weekSonnet', '每周 Sonnet']]
  const backend = data?.engine === 'codex' ? 'Codex' : data?.model?.startsWith('account/') ? 'Claude · 订阅账号' : 'Claude · OpenRouter'
  const pair = !data?.paired && (data?.codex?.ready || data?.account?.ready) && <button className="sheet-item" onClick={async () => {
    if (await requestEnginePair()) load()
  }}>连接这台设备以查看额度</button>
  return <>
    <div className="set-group engine-usage">
      <div className="set-group-name">Claude · {data?.account?.plan?.toUpperCase() || '订阅账号'}</div>
      <div className="set-row"><span>当前后端</span><span>{backend}</span></div>
      <div className="set-hint">{data?.account?.ready ? '已登录 · 与这个账号的 claude.ai、Claude Code 共享额度' : '等待 VPS 完成 Claude 账号登录'}</div>
      {data?.account?.ready && pair}
      {data?.paired && accountWindows.map(([key, label]) => data.account?.limits?.[key] ? <Meter key={key} label={label} w={data.account.limits[key]} /> : null)}
      {data?.paired && data.account?.ready && !data.account.limits && <div className="set-hint">暂时没有返回额度明细。</div>}
    </div>
    <div className="set-group engine-usage">
      <div className="set-group-name">Codex · {data?.codex?.plan?.toUpperCase() || 'ChatGPT'}</div>
      <div className="set-hint">{data?.codex?.ready ? '已登录 · 与这个账号的其他 Codex 使用共享额度' : '等待 VPS 完成 ChatGPT 授权'}</div>
      {data?.codex?.ready && !data?.account?.ready && pair}
      {data?.paired && windows.map(([key, label]) => data.codex?.limits?.[key] ? <Meter key={key} label={label} w={data.codex.limits[key]} /> : null)}
      {data?.paired && data.codex?.ready && !data.codex.limits && <div className="set-hint">暂时没有返回额度明细。</div>}
      {error && <div className="set-hint">暂时无法读取，保留上次数据。</div>}
      <button className="sheet-item" onClick={load}>刷新状态</button>
    </div>
  </>
}
