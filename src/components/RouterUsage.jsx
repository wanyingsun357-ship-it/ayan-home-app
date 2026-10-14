import { useState } from 'react'
const dollars = n => n == null ? '—' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tokens = n => n >= 1000000 ? (n / 1000000).toFixed(2) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0)
const percent = n => n == null ? '—' : (n * 100).toFixed(1) + '%'
export default function RouterUsage({ data, loading, error, refresh }) {
  const [selected, setSelected] = useState(null)
  const c = data?.cache
  const point = selected === null ? null : c?.buckets?.[selected]
  const time = value => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return <section className="router-usage" aria-label="OpenRouter 用量">
    <div className="router-heading"><div><span className="router-eyebrow">用量与花费</span><h3>OpenRouter</h3></div><button className="router-refresh" disabled={loading} onClick={refresh}>{loading ? '更新中…' : '↻ 刷新'}</button></div>
    {error && <p className="router-note" role="status">暂时没连上，{data ? '保留上次数据。' : '稍后可以再刷新。'}</p>}
    <div className="router-wallet">
      <div className="router-wallet-label">账户余额 <span>USD</span></div>
      <div className="router-balance">{loading && !data ? '读取中…' : dollars(data?.balance)}</div>
      {data?.balance == null && !loading && <p className="router-note">{data?.balanceError === 'permission' ? '余额暂未授权读取，可前往 OpenRouter 查看。' : '暂时无法读取账户余额。'}</p>}
      <div className="router-spend"><div><span>今日花费</span><strong>{dollars(data?.daily)}</strong></div><div><span>本月花费</span><strong>{dollars(data?.monthly)}</strong></div><a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer">查看账单 ↗</a></div>
    </div>
    <p className="router-note">花费统计为当前 App Key；日期以 OpenRouter 账单为准。{data?.keyLimitRemaining != null && <> Key 剩余限额 {dollars(data.keyLimitRemaining)}，不代表账户余额。</>}</p>
    <div className="router-cache">
      <div className="router-cache-title"><span>缓存命中率</span><span>近 24 小时 · 按输入 token</span></div>
      <div className="router-rate"><strong>{percent(c?.rate)}</strong><span>{c?.change == null ? '累积数据后显示日间变化' : `${c.change >= 0 ? '↑' : '↓'} ${Math.abs(c.change * 100).toFixed(1)} 个百分点 · 较前 24h`}</span></div>
      <div className="router-chart" aria-label="每两小时的缓存命中率">
        {(c?.buckets || Array.from({ length: 12 }, () => ({ rate: null, requests: 0 }))).map((p, i) => <button key={i} className={`${p.rate === null ? 'empty' : ''} ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(selected === i ? null : i)} aria-label={`${p.at ? time(p.at) : '暂无数据'}，${percent(p.rate)}，${p.requests} 次调用`} aria-pressed={selected === i}><span style={{ height: p.rate === null ? '3px' : `${Math.max(3, p.rate * 100)}%` }} /></button>)}
      </div>
      <div className="router-chart-labels"><span>24 小时前</span><span>现在</span></div>
      <p className="router-chart-detail" aria-live="polite">{point ? `${time(point.at)} 起的两小时 · ${point.requests} 次调用 · 命中 ${percent(point.rate)}` : c?.requests ? `${c.requests} 次调用 · ${c.hits} 次读到缓存 · 点柱子看分时数据` : '还没有用量记录，聊几轮后就会在这里出现。'}</p>
      <div className="router-token-grid"><div><span>缓存读取</span><b>{tokens(c?.read)}</b></div><div><span>新建缓存</span><b>{tokens(c?.write)}</b></div><div><span>普通输入</span><b>{tokens(c?.input)}</b></div></div>
      <div className="router-policy"><span>主聊天 · 1 小时缓存</span><span>后台 · 5 分钟缓存</span></div>
      <details className="router-explain"><summary>这些数字怎么看？</summary><p>命中率 = 缓存读取 ÷（普通输入 + 缓存读取 + 新建缓存），不等于费用节省比例。图中空白表示没有调用记录，不是 0% 命中。统计来自 App 已结束调用的本地记录，可能包含连接测试，不覆盖账号的其他应用。{c?.since && <> 当前保留记录始于 {new Date(c.since).toLocaleString('zh-CN')}。</>}</p></details>
    </div>
    <div className="router-updated">{data?.fetchedAt ? `账单更新于 ${time(data.fetchedAt)} · 最多约 1 分钟延迟` : '等待同步账单'}</div>
  </section>
}
