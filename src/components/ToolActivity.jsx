import { isDevelopmentTool } from '../utils/developmentTools.js'
import { parseTimeline } from '../utils/thoughtTimeline.js'
import './toolActivity.css'

export default function ToolActivity({ text, streaming }) {
  const tools = parseTimeline(text).filter(entry => entry.kind === 'tool' && isDevelopmentTool(entry.text))
  if (!tools.length) return null
  const state=tools.some(t=>t.status==='failed')?'failed':tools.every(t=>t.status==='completed')?'completed':streaming?'running':'unknown'
  const label={failed:'有操作失败',completed:'已完成 · 已记录',running:'执行中',unknown:'已记录'}[state]
  return <details className="tool-activity glass2" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
    <summary>
      <span className="tool-activity-head"><span className={`tool-activity-mark ${state}`} aria-label={label}>{state==='completed'?'✓':state==='failed'?'!':state==='running'?'◌':'›_'}</span><span><strong>{tools.length} 个开发操作</strong><small>{streaming ? '正在记录这一轮' : '代码与终端'}</small></span><span className="tool-activity-expand" aria-hidden="true">↗</span></span>
      <span className="tool-activity-preview">{tools.slice(-3).map((tool, i) => <span key={i}><i aria-hidden="true">›</i>{tool.text.replace(/\s+/g, ' ')}</span>)}</span>
      <span className="tool-activity-footer"><span className={`tool-activity-dot ${state}`} /><span>{label}</span><span className="tool-activity-open">展开详情 ⌄</span><span className="tool-activity-close">收起详情 ⌃</span></span>
    </summary>
    <div className="tool-activity-list">{tools.map((tool, i) => <section key={i}><header><span>{String(i + 1).padStart(2, '0')} · {tool.label}</span><small>{tool.name}</small></header><pre><code>{tool.text}</code></pre></section>)}</div>
  </details>
}
