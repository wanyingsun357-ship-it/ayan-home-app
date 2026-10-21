import { parseTimeline } from '../utils/thoughtTimeline.js'
import './thoughtTimeline.css'

const paths = {
  heart: 'M12 20S3 14.5 3 8.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 1.5C21 14.5 12 20 12 20Z',
  book: 'M12 5v15M12 5C8 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-5-1-9 1Z',
  list: 'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',
  file: 'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6',
  image: 'M3 4h18v16H3V4Zm0 12 5-5 4 4 3-3 6 6M15 8h.01',
  search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  terminal: 'm5 6 6 6-6 6M13 18h6',
  chat: 'M21 11a9 8 0 0 1-9 8H8l-5 3 1-6a8 8 0 0 1-1-5 9 8 0 0 1 18 0Z',
  voice: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  tool: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3',
}
function Icon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.tool} /></svg>
}
export default function ThoughtTimeline({ text, engine = 'claude' }) {
  const entries = parseTimeline(text)
  if (!entries.some(entry => entry.kind === 'tool')) {
    return <div className="thought-plain">{String(text || '').replace(/^[ \t]*【心声】[ \t]*(?:\r?\n|$)/gm, '').trimStart()}</div>
  }
  return <div className="thought-timeline">
    {entries.map((entry, i) => <div className={`thought-step ${entry.kind}`} key={i}>
      <span className="thought-step-icon"><Icon name={entry.icon || 'voice'} /></span>
      {entry.kind === 'tool' ? <details className="thought-tool">
        <summary><span className="thought-tool-label">{entry.label}</span><span className="thought-tool-name">{entry.name}</span><span className="thought-tool-chevron" aria-hidden="true">⌄</span></summary>
        <pre>{entry.text}</pre>
      </details> : <div className="thought-step-copy">
        {entry.kind === 'summary' && <span className="thought-summary-label">{engine === 'codex' ? '心声摘要' : 'Thinking 摘要'}</span>}
        {entry.text}
      </div>}
    </div>)}
  </div>
}
