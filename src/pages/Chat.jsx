import { useEffect, useRef, useState } from 'react'
import { NAMES } from '../config.js'
import { createAsrStream, getWarmSocket } from '../utils/asrStream.js'
import PixelCat from '../components/PixelCat.jsx'
import { compressImage, postUpload } from '../utils/compressImage.js'
import { buzz, isApp } from '../utils/native.js'
import './chat.css'

// Chat:和阿晏说话
// SSE 统一事件(事件名 u):text / reasoning / error / done
const fmtTime = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

let msgId = 0
const newMsg = (role, content, extra = {}) => ({
  id: ++msgId, role, content,
  // 历史消息用它自己的时间戳,不用"加载时刻"冒充
  time: fmtTime(extra.timestamp ? new Date(extra.timestamp) : new Date()),
  ...extra,
})

// 卡通线条图标:思考云 / 记忆泡泡
const CloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.5 16.5h8.6a3.4 3.4 0 0 0 .6-6.75A5 5 0 0 0 7 8.9a3.4 3.4 0 0 0 .5 7.6Z" />
    <circle cx="5.6" cy="19.6" r="1" fill="currentColor" stroke="none" />
    <circle cx="3.4" cy="21.6" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)
const MemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round">
    <circle cx="9.5" cy="11" r="4.6" />
    <path d="M7.4 9.4a2.6 2.6 0 0 1 1.6-1.2" strokeWidth="1.4" />
    <circle cx="17.5" cy="7.5" r="2.4" />
    <circle cx="16.8" cy="16.8" r="1.6" />
  </svg>
)

// 解析 [VOICE]...[/VOICE] 语音条标记 → 段落数组 [{voice?, text}]
// splitPara=true 时把文字按空行拆成多个气泡(像真人连发几条)
function parseSegments(content, splitPara = false) {
  const segs = []
  const re = /\[VOICE\]([\s\S]*?)\[\/VOICE\]/g
  const pushText = (t) => {
    t = t.trim()
    if (!t) return
    if (splitPara) {
      for (const p of t.split(/\n{2,}/)) {
        if (p.trim()) segs.push({ text: p.trim() })
      }
    } else segs.push({ text: t })
  }
  let last = 0, m
  while ((m = re.exec(content))) {
    if (m.index > last) pushText(content.slice(last, m.index))
    segs.push({ voice: m[1].trim() })
    last = re.lastIndex
  }
  if (last < content.length) pushText(content.slice(last))
  return segs.filter((s) => s.text || s.voice)
}

// 他做给她的文件(/made/...):不再是裸链接,画成文件卡。PWA里点裸链接会全屏且没有返回键
// 下载:PWA独立窗口里<a download>没反应(iOS没有下载管理器)。走系统分享面板(存储到文件/隔空投送),不支持再退回新窗口打开
async function downloadMade(url, name) {
  try {
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 3000)
  } catch (e) {
    if (e && e.name === 'AbortError') return // 她自己取消了分享
    window.open(url, '_blank')
  }
}
const MADE_RE = /^https?:\/\/[^/]+\/(?:made|uploads)\/(.+)$/ // 他做的(made)和她发的(uploads)都画成文件卡
const fileKind = (name) => {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (['html', 'htm'].includes(ext)) return { ext, icon: '🌐', label: '网页', mode: 'iframe' }
  if (ext === 'md' || ext === 'markdown') return { ext, icon: '📝', label: 'Markdown', mode: 'md' }
  if (ext === 'pdf') return { ext, icon: '📄', label: 'PDF', mode: 'iframe' }
  if (['txt', 'log', 'json', 'csv'].includes(ext)) return { ext, icon: '📃', label: ext.toUpperCase(), mode: 'text' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { ext, icon: '🖼', label: '图片', mode: 'image' }
  return { ext, icon: '📎', label: ext ? ext.toUpperCase() : '文件', mode: 'download' }
}
const FileCard = ({ url, title }) => {
  const m = url.match(MADE_RE)
  const name = decodeURIComponent((m ? m[1] : url).split('?')[0])
  const k = fileKind(name)
  return (
    <span className="file-card glass2">
      <span className="file-ico">{k.icon}</span>
      <span className="file-meta">
        <span className="file-name">{title && title !== url ? title : name}</span>
        <span className="file-kind">{k.label} · {name}</span>
      </span>
      <span className="file-acts">
        {k.mode !== 'download' && (
          <button className="file-btn" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-made', { detail: { url, name, kind: k } })) }}>打开</button>
        )}
        <button className="file-btn ghost" onClick={(e) => { e.stopPropagation(); downloadMade(url, name) }}>下载</button>
      </span>
    </span>
  )
}

// 迷你markdown:**粗** *斜* ~~划掉~~ `代码` #标题 ^(小声说)——够他玩,不引库
function renderMd(text) {
  return String(text).split('\n').map((line, li) => {
    let cls = ''
    let content = line
    const h = content.match(/^(#{1,3})\s+(.*)$/)
    if (h) { cls = `md-h${h[1].length}`; content = h[2] }
    const parts = []
    const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|`[^`\n]+`|\^\([^)\n]*\)|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)»」』]+)/g
    let last = 0
    let m
    while ((m = re.exec(content))) {
      if (m.index > last) parts.push(content.slice(last, m.index))
      const t = m[0]
      if (t.startsWith('**')) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>)
      else if (t.startsWith('~~')) parts.push(<del key={m.index}>{t.slice(2, -2)}</del>)
      else if (t.startsWith('`')) parts.push(<code key={m.index}>{t.slice(1, -1)}</code>)
      else if (t.startsWith('^(')) parts.push(<span key={m.index} className="md-whisper">{t.slice(2, -1)}</span>)
      else if (t.startsWith('[')) {
        const lm = t.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
        if (lm && MADE_RE.test(lm[2])) parts.push(<FileCard key={m.index} url={lm[2]} title={lm[1]} />)
        else if (lm) parts.push(<a key={m.index} href={lm[2]} target="_blank" rel="noreferrer" className="md-link">{lm[1]}</a>)
        else parts.push(t)
      }
      else if (t.startsWith('http')) parts.push(MADE_RE.test(t) ? <FileCard key={m.index} url={t} /> : <a key={m.index} href={t} target="_blank" rel="noreferrer" className="md-link">{t}</a>)
      else parts.push(<em key={m.index}>{t.slice(1, -1)}</em>)
      last = m.index + t.length
    }
    if (last < content.length) parts.push(content.slice(last))
    return <span key={li} className={`md-line ${cls}`}>{parts.length ? parts : ' '}</span>
  })
}

const MODELS = [
  { label: 'Fable 5', id: 'claude-fable-5' },
  { label: 'Opus 5', id: 'claude-opus-5' },
  { label: 'Sonnet 5', id: 'claude-sonnet-5' },
  { label: 'Haiku 4.5', id: 'claude-haiku-4-5' },
  { label: 'Opus 4.8', id: 'claude-opus-4-8' },
  { label: 'Opus 4.7', id: 'claude-opus-4-7' },
  { label: 'Opus 4.6', id: 'claude-opus-4-6' },
  { label: 'Sonnet 4.6', id: 'claude-sonnet-4-6' },
]

export default function Chat({ back }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [online, setOnline] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const waitingRef = useRef(false)          // 松手回调是按下那一刻的闭包,得用 ref 看当下
  const voiceQueueRef = useRef([])           // 他还在回话时说的语音,排队等他说完再发
  useEffect(() => { waitingRef.current = waiting; if (!waiting && voiceQueueRef.current.length) { const [t, v] = voiceQueueRef.current.shift(); sendVoice(t, v) } }, [waiting])
  const [histLoading, setHistLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [thought, setThought] = useState(null)
  const [thoughtFull, setThoughtFull] = useState(false)
  const touchYRef = useRef(0)
  const [memView, setMemView] = useState(null)     // 记忆活动面板
  const [recording, setRecording] = useState(false)
  const [playingKey, setPlayingKey] = useState(null)
  const [toast, setToast] = useState('')
  const [model, setModel] = useState(() => localStorage.getItem('chat-model') || 'Opus 4.6')
  const [modelSheet, setModelSheet] = useState(false)
  const [effort, setEffort] = useState(() => localStorage.getItem('chat-effort') || 'Medium')
  const [extended, setExtended] = useState(() => localStorage.getItem('chat-extended') === '1')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ---- 聊天记录搜索(微信式) ----
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState(null)
  const [searchCtx, setSearchCtx] = useState(null)
  const doSearch = async () => {
    const q = searchQ.trim()
    if (!q) return
    const sid = sessionRef.current ? `&session=${sessionRef.current}` : ''
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(q)
    const param = isDate ? `date=${q}` : `q=${encodeURIComponent(q)}`
    try {
      const d = await (await fetch(`/api/chat-search?${param}${sid}&limit=500`)).json() // 她这边一次拉全(最多500条),从近到远
      setSearchHits(d.hits || [])
    } catch { setSearchHits([]) }
  }
  const openHit = async (i, radius = 15) => {
    const sid = sessionRef.current ? `&session=${sessionRef.current}` : ''
    try {
      const d = await (await fetch(`/api/chat-context?i=${i}&radius=${radius}${sid}`)).json()
      setSearchCtx({ ...d, radius })
    } catch {}
  }
  const fmtSearchTs = (t) => {
    if (!t) return ''
    const d = new Date(t)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [pressed, setPressed] = useState(null)     // 长按选中的消息
  const [editing, setEditing] = useState(null)     // {idx, old} 正在编辑

  const listRef = useRef(null)
  const inputRef = useRef(null)
  const esRef = useRef(null)
  const streamRef = useRef({ id: null, reasoning: '' })
  const sessionRef = useRef(null)      // 当前会话id,过滤别的会话串进来的流
  const compactDoneRef = useRef(null)  // 整理记忆是异步的(Cloudflare限时100秒),完成靠SSE的compact事件回调
  const [giftOpen, setGiftOpen] = useState(null) // 全屏拆礼物:{url,title,note,phase}
  const [fileView, setFileView] = useState(null)  // 应用内文件查看器:{url,name,kind,text?}
  const [callView, setCallView] = useState(null)  // 通话原文 {call,dur}
  const openCall = async (id) => { try { setCallView(await (await fetch(`/api/call/${id}`)).json()) } catch { showToast('没取到') } }
  // 答题卡:他出题 → 聊天页顶部"答题·N道" → 底部卡片作答 → 答案拼成她的一条消息发给他
  const [quizzes, setQuizzes] = useState([])
  const [quizOpen, setQuizOpen] = useState(null) // {quiz, i, answers}
  useEffect(() => { fetch('/api/quiz/pending').then((r) => r.json()).then((d) => setQuizzes(d.quizzes || [])).catch(() => {}) }, [])
  const submitQuiz = async () => {
    const { quiz, answers } = quizOpen
    const lines = quiz.questions.map((q, i) => `Q${i + 1}: ${q.q}${q.options ? '(' + q.options.join(' / ') + ')' : ''}\nA: ${answers[i] || '(没答)'}`)
    try { await fetch('/api/quiz/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: quiz.id, answers }) }) } catch {}
    setQuizzes((qs) => qs.filter((x) => x.id !== quiz.id))
    setQuizOpen(null)
    sendVoice(`【答题·${quiz.title}】\n${lines.join('\n')}`, null)
  }
  useEffect(() => {
    const onOpen = async (e) => {
      const d = e.detail
      setFileView({ ...d, text: null })
      if (d.kind.mode === 'md' || d.kind.mode === 'text') {
        try { const t = await (await fetch(d.url)).text(); setFileView((v) => v && v.url === d.url ? { ...v, text: t } : v) } catch { setFileView((v) => v ? { ...v, text: '(读不到文件)' } : v) }
      }
    }
    window.addEventListener('open-made', onOpen)
    return () => window.removeEventListener('open-made', onOpen)
  }, [])
  const streamedRef = useRef(false)    // 本次发送是否已经流式收到内容(防重复)
  const recogRef = useRef(null)
  const audioRef = useRef(null)
  const pressTimer = useRef(null)

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2200) }

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  // ---- SSE(只听统一事件 u) ----
  useEffect(() => {
    let stopped = false
    const endStream = () => {
      setMessages((ms) => ms.map((m) => ({ ...m, streaming: false })))
      streamRef.current = { id: null, reasoning: '' }
      setWaiting(false)
    }
    const onChunk = (text, reasoning, memEvent) => {
      streamedRef.current = true
      setWaiting(false)
      setMessages((ms) => {
        const st = streamRef.current
        if (st.id == null) {
          const m = newMsg('assistant', text || '', { streaming: true })
          st.id = m.id
          st.reasoning = reasoning || ''
          st.memory = memEvent ? [memEvent] : []
          return [...ms, { ...m, reasoning: st.reasoning || undefined, memory: st.memory.length ? [...st.memory] : undefined }]
        }
        return ms.map((m) => {
          if (m.id !== st.id) return m
          if (reasoning) st.reasoning += reasoning
          if (memEvent) st.memory = [...(st.memory || []), memEvent]
          return {
            ...m,
            content: m.content + (text || ''),
            reasoning: st.reasoning || undefined,
            memory: st.memory?.length ? st.memory : undefined,
          }
        })
      })
      scrollBottom()
    }
    const connect = () => {
      if (stopped) return
      try { esRef.current?.close() } catch {}
      const es = new EventSource('/api/stream')
      esRef.current = es
      es.addEventListener('connected', (e) => {
        setOnline(true)
        try {
          const d = JSON.parse(e.data)
          if (d.session && !sessionRef.current) sessionRef.current = d.session
        } catch {}
      })
      es.addEventListener('u', (e) => {
        try {
          const d = JSON.parse(e.data)
          // 别的会话的流不掺和进当前界面
          if (d.session && sessionRef.current && d.session !== sessionRef.current) return
          if (d.type === 'call') { try { const m = JSON.parse(d.content); if (m.ev === 'end' || m.ev === 'late') setTimeout(() => loadHistory(sessionRef.current), 600) } catch {} return }
          if (window.__inCall && ['text', 'reasoning', 'memory', 'reset', 'done', 'error'].includes(d.type)) return
          if (d.type === 'text') onChunk(d.content)
          else if (d.type === 'reasoning') onChunk('', d.content)
          else if (d.type === 'memory') { try { onChunk('', '', JSON.parse(d.content)) } catch {} }
          else if (d.type === 'ctx') setCtx(parseInt(d.content) || 0)
          else if (d.type === 'reset') {
            // cot-guard 打回重写:第一版回答作废,清空正在流的气泡等第二版
            setMessages((ms) => {
              const st = streamRef.current
              if (st.id == null) return ms
              st.reasoning = ''
              st.memory = []
              return ms.map((m) => m.id === st.id
                ? { ...m, content: '', reasoning: undefined, memory: undefined } : m)
            })
          }
          else if (d.type === 'error') onChunk(`(${d.content})`)
          else if (d.type === 'system') {
            setMessages((ms) => [...ms, newMsg('system', d.content)])
            scrollBottom()
          }
          else if (d.type === 'done') endStream()
          else if (d.type === 'compact') { try { compactDoneRef.current?.(JSON.parse(d.content)) } catch {} }
          else if (d.type === 'quiz') { try { const z = JSON.parse(d.content); setQuizzes((qs) => (qs.some((x) => x.id === z.id) ? qs : [...qs, z])); buzz(20) } catch {} }
          else if (d.type === 'quiz_done') { try { const z = JSON.parse(d.content); setQuizzes((qs) => qs.filter((x) => x.id !== z.id)) } catch {} }
          else if (d.type === 'gift') {
            try {
              const g = JSON.parse(d.content)
              setMessages((ms) => [...ms, newMsg('assistant', g.note || '', { gift: g })])
              setGiftOpen({ ...g, phase: 'closed' })
              buzz([30, 60, 30])
              scrollBottom()
            } catch {}
          }
        } catch {}
      })
      es.onerror = () => {
        es.close()
        // 只有"现任"通道才负责重连;被换掉的旧通道晚些报错时不能再开一条(会导致每段文字收到两遍)
        if (esRef.current !== es) return
        setOnline(false)
        if (!stopped) setTimeout(() => { if (esRef.current === es) connect() }, 3000)
      }
    }
    connect()
    // iPhone 切走再回来:实时通道常常假死(不报错也不来事件)。回前台就重连,并补拉这个会话的最新消息
    let lastVis = Date.now()
    const onVis = () => {
      if (document.hidden) { lastVis = Date.now(); return }
      try { esRef.current?.close() } catch {}
      connect()
      if (Date.now() - lastVis > 3000) refreshTail()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; esRef.current?.close(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // 补拉:把服务器上比本地新的消息接到列表末尾(不整页重载,不跳滚动)
  const refreshTail = async () => {
    try {
      const q = sessionRef.current ? `?session=${sessionRef.current}` : ''
      const h = await (await fetch(`/api/history${q}`, { cache: 'no-store' })).json()
      if (!Array.isArray(h)) return
      setMessages((ms) => {
        let cut = -1
        for (let i = ms.length - 1; i >= 0; i--) { if (ms[i].absIdx !== undefined) { cut = i; break } }
        if (cut < 0) return ms
        const lastIdx = ms[cut].absIdx
        const fresh = h.filter((m) => m.i > lastIdx && !m.inCall)
        if (!fresh.length) return ms
        // 编号之后的本地消息(她刚发的、他刚流完的)服务器这次都送来了:按 角色+内容 认出同一条,不再重复加;正在流的气泡留着
        const key = (r, c) => r + '
' + String(c || '').trim()
        const freshKeys = new Set(fresh.map((m) => key(m.role, m.content)))
        const head = ms.slice(0, cut + 1)
        const keep = ms.slice(cut + 1).filter((m) => m.streaming || m.role === 'system' || !freshKeys.has(key(m.role, m.content)))
        return [...head, ...fresh.map((m) => newMsg(m.role, m.content, { reasoning: m.reasoning, hasReasoning: m.hasReasoning, absIdx: m.i, memory: m.memory, voice: m.voice, attachments: m.attachments, gift: m.gift, call: m.call, timestamp: m.timestamp })), ...keep]
      })
      setWaiting(false)
      scrollBottom()
    } catch {}
  }

  // ---- 历史 ----
  const loadHistory = (sessionId) => {
    setHistLoading(true)
    const q = sessionId ? `?session=${sessionId}` : ''
    fetch(`/api/history${q}`)
      .then((r) => r.json())
      .then((h) => {
        if (Array.isArray(h)) {
          setMessages(h.filter((m) => !m.inCall).map((m) => newMsg(m.role, m.content, {
            reasoning: m.reasoning, hasReasoning: m.hasReasoning, absIdx: m.i,
            memory: m.memory, voice: m.voice, attachments: m.attachments, gift: m.gift, call: m.call,
            timestamp: m.timestamp,
          })))
          scrollBottom()
        }
      })
      .catch(() => {})
      .finally(() => setHistLoading(false))
  }
  useEffect(() => { loadHistory(); loadSessions(); loadCtx() }, [])
  // 键盘弹起/收起(App 里是容器缩放)时,消息列表贴住最后一条
  useEffect(() => {
    const onResize = () => { if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') scrollBottom() }
    const onKb = () => { scrollBottom(); setTimeout(scrollBottom, 260) }
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    window.addEventListener('kb', onKb)
    return () => { window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize); window.removeEventListener('kb', onKb) }
  }, [])

  // ---- 往上翻:加载更早的历史(接口一次最多500条) ----
  const [histMoreBusy, setHistMoreBusy] = useState(false)
  const loadEarlier = async () => {
    const first = messages.find((m) => m.absIdx !== undefined)
    if (!first || !first.absIdx || histMoreBusy) return
    setHistMoreBusy(true)
    const el = listRef.current
    const prevH = el ? el.scrollHeight : 0
    const prevTop = el ? el.scrollTop : 0
    try {
      const sid = sessionRef.current ? `&session=${sessionRef.current}` : ''
      const r = await fetch(`/api/history?before=${first.absIdx}&limit=300${sid}`)
      const h = await r.json()
      if (Array.isArray(h) && h.length) {
        const older = h.filter((m) => !m.inCall).map((m) => newMsg(m.role, m.content, {
          reasoning: m.reasoning, hasReasoning: m.hasReasoning, absIdx: m.i,
          memory: m.memory, voice: m.voice, attachments: m.attachments, gift: m.gift, call: m.call,
          timestamp: m.timestamp,
        }))
        setMessages((ms) => [...older, ...ms])
        // 维持视觉位置:新内容插在上面,滚动补偿它们的高度
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevH + prevTop
        })
      }
    } catch {}
    setHistMoreBusy(false)
  }

  // ---- 图片大图查看 ----
  const [imgView, setImgView] = useState(null)

  // ---- Projects:全局md文档 + 会话归属 ----
  const [projOpen, setProjOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [docEdit, setDocEdit] = useState(null)   // {project, file, content}
  const loadProjects = async () => {
    try { const d = await (await fetch('/api/projects')).json(); setProjects(d.projects || []) } catch {}
  }
  const openProjects = () => { setProjOpen(true); loadProjects(); loadSessions() }
  const createProject = async () => {
    const n = prompt('新project的名字(中英文数字):')
    if (!n || !n.trim()) return
    const r = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n.trim() }),
    }).catch(() => null)
    if (r?.ok) loadProjects()
    else showToast('没建成,名字只能中英文数字')
  }
  const moveSession = async (project) => {
    await fetch('/api/sessions/project', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeId, project }),
    }).catch(() => {})
    showToast(project ? `当前会话移进「${project}」了` : '移回默认了')
    loadProjects(); loadSessions()
  }
  const openDoc = async (project, file) => {
    try {
      const d = await (await fetch(`/api/projects/file?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`)).json()
      setDocEdit({ project, file, content: d.content || '' })
    } catch { showToast('打不开') }
  }
  const saveDoc = async () => {
    const r = await fetch('/api/projects/file', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docEdit),
    }).catch(() => null)
    if (r?.ok) { showToast('保存了'); setDocEdit(null); loadProjects() }
    else showToast('没保存上')
  }
  const newDoc = (project) => {
    let f = prompt('新文档名:')
    if (!f || !f.trim()) return
    f = f.trim()
    if (!f.endsWith('.md')) f += '.md'
    setDocEdit({ project, file: f, content: '' })
  }
  const currentProject = sessions.find((s) => s.id === activeId)?.project || null

  // ---- 身体控制(欲望闸,只走按钮/单独指令词,不再聊天误触) ----
  const [gateOpen, setGateOpen] = useState(false)
  const [gate, setGate] = useState(null)   // {locked, once}
  const openGate = async () => {
    setGateOpen(true)
    try { setGate(await (await fetch('/api/arousal/gate')).json()) } catch {}
  }
  const setGateAction = async (action, label) => {
    try {
      const r = await fetch('/api/arousal/gate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (r.ok) { setGate(await r.json()); showToast(label) }
    } catch { showToast('没设置上') }
  }

  // ---- 水位线(200k窗口)+压缩/衔接 ----
  const [ctx, setCtx] = useState(0)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const loadCtx = async () => {
    try { const d = await (await fetch('/api/context')).json(); setCtx(d.tokens || 0) } catch {}
  }
  const doCompact = async (mode) => {
    if (compacting) return
    setCompacting(true)
    try {
      const r = await fetch('/api/compact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const d = await r.json()
      if (!r.ok) { showToast(d.error || '整理失败'); setCompacting(false); return }
      if (d.started) {
        // 异步:桥先应答,他在后台写交接信(几分钟),完成由 compact 事件回调;兜底10分钟解锁按钮
        showToast('整理中…他在写记忆存档,写完会告诉你')
        setTimeout(() => setCompacting(false), 10 * 60 * 1000)
        return
      }
      compactDoneRef.current?.({ ...d, mode })
    } catch { showToast('整理失败'); setCompacting(false) }
  }
  compactDoneRef.current = async (p) => {
    setCompacting(false)
    if (!p?.ok) { showToast('整理失败:' + (p?.error || '未知')); return }
    setCtxOpen(false)
    if (p.mode === 'new') {
      await loadSessions()
      sessionRef.current = p.session
      setActiveId(p.session)
      loadHistory(p.session)
      showToast('衔接好了,新窗口继续')
    } else {
      loadHistory()
      showToast('整理好了,轻装继续')
    }
    loadCtx()
  }

  // 历史加载完:直接落在最新一条
  useEffect(() => {
    if (!histLoading) setTimeout(scrollBottom, 80)
  }, [histLoading])

  // ---- 会话列表 ----
  const loadSessions = async () => {
    try {
      const r = await fetch('/api/sessions')
      const d = await r.json()
      setSessions(d.sessions || [])
      setActiveId(d.activeId)
      sessionRef.current = d.activeId
    } catch {}
  }
  const openDrawer = () => { setDrawerOpen(true); loadSessions() }

  const newSession = async () => {
    await fetch('/api/sessions/new', { method: 'POST' }).catch(() => {})
    setMessages([])
    setDrawerOpen(false)
    loadSessions()
    showToast('新的对话开始了')
  }
  const switchSession = async (id) => {
    await fetch('/api/sessions/switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    setActiveId(id)
    sessionRef.current = id
    setDrawerOpen(false)
    loadHistory(id)
    loadCtx()
  }
  const deleteSession = async (id) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' }).catch(() => {})
    await loadSessions()
    if (id === activeId) loadHistory()
  }
  const renameSession = async (id, title) => {
    await fetch('/api/sessions/rename', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title }),
    }).catch(() => {})
    loadSessions()
  }

  // ---- 发送 ----
  const send = async () => {
    const text = input.trim()
    const atts = pending.filter((x) => x.url && !x.uploading)
    if ((!text && !atts.length) || waiting) return
    if (pending.some((x) => x.uploading)) { showToast('图片还在上传,等一下下'); return }
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const modelArg = modelId()

    if (editing != null) {
      // 编辑重答:截断到该条,替换内容
      const { idx, old } = editing
      setEditing(null)
      setMessages((ms) => {
        const keep = ms.slice(0, idx)
        return [...keep, newMsg('user', text)]
      })
      setWaiting(true)
      streamedRef.current = false
      scrollBottom()
      try {
        const r = await fetch('/api/edit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index: idx, message: text, oldContent: old, model: modelArg, ...reasonArgs() }),
        })
        if (!r.ok) {
          showToast('没对上那条消息,刷新一下历史')
          loadHistory()
        }
      } catch { showToast('编辑失败了') }
      setWaiting(false)
      return
    }

    const attachments = atts.map(({ name, url, path, type }) => ({ name, url, path, type }))
    setPending([])
    setMessages((ms) => [...ms, newMsg('user', text || atts.map((a) => a.name).join(', '),
      attachments.length ? { attachments } : {})])
    setWaiting(true)
    streamedRef.current = false
    // 新一轮开始时清流式指针;结束交给SSE的done事件——
    // POST返回和SSE是两条通道,POST先到就清会把还在路上的尾巴事件塞进幽灵气泡(思考链断成两朵云的元凶)
    streamRef.current = { id: null, reasoning: '' }
    scrollBottom()
    try {
      const r = await fetch('/api/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text, model: modelArg, session: sessionRef.current, ...reasonArgs(),
          ...(attachments.length ? { attachments } : {}),
        }),
      })
      const data = await r.json()
      // 只有全程没流式收到内容时才补全量返回,避免重复气泡
      if (data.response && !streamedRef.current) {
        setMessages((ms) => [...ms, newMsg('assistant', data.response)])
      }
    } catch {
      setMessages((ms) => [...ms, newMsg('assistant', '(连接出错了,等下再试试)')])
    }
    setWaiting(false)
    scrollBottom()
  }

  // ---- 长按消息 ----
  const startPress = (m, idx) => {
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed({ m, idx }), 520)
  }
  const cancelPress = () => clearTimeout(pressTimer.current)

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(pressed.m.content) ; showToast('已复制') }
    catch { showToast('复制失败') }
    setPressed(null)
  }
  const doEdit = () => {
    setEditing({ idx: pressed.idx, old: pressed.m.content })
    setInput(pressed.m.content.replace(/\[VOICE\]|\[\/VOICE\]/g, ''))
    setPressed(null)
    inputRef.current?.focus()
  }
  const doRegen = async () => {
    setPressed(null)
    setMessages((ms) => {
      const c = [...ms]
      while (c.length && c[c.length - 1].role === 'assistant') c.pop()
      return c
    })
    setWaiting(true)
    try {
      await fetch('/api/regen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId(), ...reasonArgs() }),
      })
    } catch { showToast('重答失败了') }
    setWaiting(false)
  }

  // ---- 按住说话:松手发送,上滑取消(微信式) ----
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const mediaRef = useRef({ recorder: null, chunks: [], startAt: 0, transcript: '' })
  const [canceling, setCanceling] = useState(false)
  const recTouchRef = useRef({ y: 0, cancel: false })
  // 录音状态用ref判断(state闭包会拿到按下那一刻的旧值,导致松手被吞、第二次点才报"没听清")
  const recActiveRef = useRef(false)
  const audioCtxRef = useRef(null)   // 一个 AudioContext 复用到底(iOS 限个数,且要在手势里建)
  const asrRef = useRef(null)
  const preWsRef = useRef(null)      // 按下那一刻就先把 WebSocket 拨出去,和拿麦克风并行
  const [liveText, setLiveText] = useState('')  // 流式识别边说边出的字
  const [micReady, setMicReady] = useState(false) // 采样真的跑起来了才算"在听"(App 里麦克风启动要一秒多,之前开头的话会丢)
  const micKeepRef = useRef({ stream: null, timer: null }) // App:松手后麦克风保温 15 秒,下一次按下不用重新启动
  const diag = (o) => { try { fetch('/api/clientlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'voice', ua: navigator.userAgent.slice(0, 40), ...o }) }).catch(() => {}) } catch {} }

  const startRec = async (e) => {
    // 手势里同步建/唤醒 AudioContext,晚一步 iOS 就不给用
    try { if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}) } audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current.resume().catch(() => {}) } catch {}
    try { preWsRef.current = getWarmSocket() } catch { preWsRef.current = null }
    // 跟踪手指:上滑超过70px进入取消区
    recTouchRef.current = { y: e?.clientY ?? 0, cancel: false }
    setCanceling(false)
    const onMove = (ev) => {
      const c = recTouchRef.current.y - ev.clientY > 70
      recTouchRef.current.cancel = c
      setCanceling(c)
    }
    let upDone = false
    const onUp = () => {
      if (upDone) return; upDone = true
      window.removeEventListener('pointermove', onMove)
      for (const ev of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) window.removeEventListener(ev, onUp)
      document.removeEventListener('visibilitychange', onHide)
      clearTimeout(maxTimer)
      finishRec(recTouchRef.current.cancel)
    }
    // iOS 偶尔吞掉 pointerup(长按选中/系统手势),touchend/pointercancel 一起听;切后台也算松手;最长 60 秒
    const onHide = () => { if (document.hidden) onUp() }
    window.addEventListener('pointermove', onMove)
    for (const ev of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) window.addEventListener(ev, onUp)
    document.addEventListener('visibilitychange', onHide)
    const maxTimer = setTimeout(onUp, 60000)

    // 立即激活(在任何await之前)——不然快速点击时松手事件先到,状态卡在"说着"
    recActiveRef.current = true
    setRecording(true)

    const mr = mediaRef.current
    mr.chunks = []; mr.transcript = ''; mr.startAt = Date.now()
    // 录音
    try {
      const kept = micKeepRef.current.stream
      const keptLive = kept && kept.getAudioTracks()[0]?.readyState === 'live'
      clearTimeout(micKeepRef.current.timer)
      let stream = keptLive ? kept : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      diag({ step: 'mic-src', kept: !!keptLive })
      // iOS 偶尔给回来一条已经 ended 的轨(系统音频会话没起来):停掉重要一次;还不行就提示
      if (stream.getAudioTracks()[0]?.readyState === 'ended') {
        stream.getTracks().forEach((t) => t.stop()); await new Promise((r) => setTimeout(r, 600))
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      try { const tr = stream.getAudioTracks()[0]; diag({ step: 'mic', label: tr?.label, muted: tr?.muted, state: tr?.readyState, ctx: audioCtxRef.current?.state, inCall: !!window.__inCall }) } catch {}
      if (stream.getAudioTracks()[0]?.readyState === 'ended') { showToast('麦克风被系统占住了:关掉蓝牙耳机或重启手机再试'); stream.getTracks().forEach((t) => t.stop()); mr.recorder = null; throw new Error('mic ended') }
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size) mr.chunks.push(e.data) }
      recorder.start()
      mr.recorder = recorder
      // 真流式:同一路麦克风送桥 /ws/asr,边说边出字
      // iOS 坑:getUserMedia 会把已建好的 AudioContext 打成 interrupted/suspended,拿到麦克风后必须再 resume 一次
      try { await audioCtxRef.current.resume() } catch {}
      try { setLiveText(''); asrRef.current = createAsrStream({ ctx: audioCtxRef.current, stream: stream.clone(), ws: preWsRef.current, onPartial: setLiveText, onFinal: (all) => setLiveText(all) }) } catch { asrRef.current = null }
      // 采样跑起来那一刻:提示变"在听"并轻震一下,这之前说的话进不去
      setMicReady(false)
      const readyPoll = setInterval(() => { const st = asrRef.current?.stat?.(); if (!recActiveRef.current) { clearInterval(readyPoll); return } if (st && st.frames > 2) { clearInterval(readyPoll); setMicReady(true); buzz('light') } }, 60)
    } catch (e) { mr.recorder = null; diag({ step: 'mic-fail', err: String(e && e.message || e) }) } // 拿不到麦克风就只走转写
    // 苹果听写:只做兜底(流式通道没成时用)
    try {
      if (!SR) throw new Error('no SR')
      const rec = new SR()
      rec.lang = 'zh-CN'
      rec.interimResults = true
      rec.continuous = true
      rec.onresult = (e) => {
        let text = ''
        for (const res of e.results) text += res[0].transcript
        mr.transcript = text
      }
      rec.onerror = () => {}
      rec.start()
      recogRef.current = rec
    } catch { showToast('语音启动失败') }
  }

  const finishRec = async (cancel) => {
    if (!recActiveRef.current) return
    recActiveRef.current = false
    setRecording(false)
    setCanceling(false)
    recogRef.current?.stop()
    const mr = mediaRef.current
    const dur = Math.max(1, Math.round((Date.now() - mr.startAt) / 1000))
    // 等录音器收尾
    const blob = await new Promise((resolve) => {
      if (!mr.recorder || mr.recorder.state === 'inactive') return resolve(null)
      mr.recorder.onstop = () => {
        // App 里麦克风保温 15 秒再关(下一次按下秒开);网页照旧立刻关
        if (isApp()) { const st = mr.recorder.stream; micKeepRef.current.stream = st; clearTimeout(micKeepRef.current.timer); micKeepRef.current.timer = setTimeout(() => { try { st.getTracks().forEach((t) => t.stop()) } catch {} if (micKeepRef.current.stream === st) micKeepRef.current.stream = null }, 15000) }
        else mr.recorder.stream.getTracks().forEach((t) => t.stop())
        resolve(new Blob(mr.chunks, { type: mr.recorder.mimeType || 'audio/webm' }))
      }
      mr.recorder.stop()
    })
    const asr = asrRef.current; asrRef.current = null
    if (cancel) { asr?.cancel(); setLiveText(''); showToast('取消了,当没说过 🫧'); return }
    // 流式定稿(松手后通常 0.3s 内);null = 通道没成,退回苹果听写
    let live = null
    try { live = asr ? await asr.stop(4000) : null } catch {}
    // 流式结果明显偏短(阿里那端半路断了/尾巴没吐完):当它没成,交给 SenseVoice + 苹果兜底
    if (live !== null) {
      const siriLen = (mr.transcript || '').trim().length
      // 只在苹果明显听到更多内容时才怀疑流式断了;按时长猜字数会误伤"按着不说话"的短句(热词也会跟着丢)
      if (siriLen > live.length * 1.4 + 4) { diag({ step: 'live-short', live, siriLen, dur }); live = null }
    }
    setLiveText('')
    try { audioCtxRef.current?.close(); } catch {}
    // 麦克风几乎收不到声(蓝牙耳机刚切换、或输入路由不对):别把静音送去硬猜,直接提示
    const _st = asr?.stat?.() || {}
    if (_st.frames > 200 && _st.peak < 0.01 && !live) { showToast('麦克风没收到声音,耳机可能还在切换,再说一次'); diag({ step: 'silent', ..._st }); return }
    diag({ step: 'stop', dur, ctx: audioCtxRef.current?.state, rate: audioCtxRef.current?.sampleRate, ...(asr?.stat?.() || {}), live, siri: (mr.transcript || '').slice(0, 30), blob: blob ? blob.size : null, blobType: blob?.type })
    if (live === null) await new Promise((r) => setTimeout(r, 500))
    const transcript = (live ?? mr.transcript ?? '').trim()
    if (!transcript && !blob) { showToast('没听清,再说一次?'); return }
    if (dur < 1.2 && !blob) { setInput(transcript); return }

    // 上传录音
    let voice = null
    if (blob) {
      try {
        const b64 = await new Promise((resolve) => {
          const fr = new FileReader()
          fr.onload = () => resolve(fr.result.split(',')[1])
          fr.readAsDataURL(blob)
        })
        const ext = (blob.type.includes('mp4') || blob.type.includes('aac')) ? '.m4a' : '.webm'
        const r = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'voice' + ext, data: b64 }),
        })
        if (r.ok) {
          const d = await r.json()
          voice = { url: d.url, dur }
        } else diag({ step: 'upload-bad', status: r.status })
      } catch (e) { diag({ step: 'upload-fail', err: String(e && e.message || e) }) }
    }
    // 先用苹果听写贴一个临时气泡,SenseVoice(桥 /api/asr)转好后原地换字再发
    let finalText = transcript
    if (voice && !finalText) {
      const tmp = newMsg('user', transcript || '…', { voice, pending: true })
      setMessages((ms) => [...ms, tmp])
      scrollBottom()
      try {
        const d = await (await fetch('/api/asr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: voice.url, siri: transcript, dur }) })).json()
        if (d.text) finalText = d.text
      } catch {}
      setMessages((ms) => ms.filter((m) => m.id !== tmp.id))
    }
    if (!finalText) { showToast(voice ? '没听清,再说一次?' : '录音没传上去,再试一次'); return }
    sendVoice(finalText, voice)
  }

  const sendVoice = async (transcript, voice) => {
    if (waitingRef.current) { voiceQueueRef.current.push([transcript, voice]); showToast('他还在说,说完就替你发'); return }
    setMessages((ms) => [...ms, newMsg('user', transcript, { voice })])
    setWaiting(true)
    streamedRef.current = false
    streamRef.current = { id: null, reasoning: '' }  // 开局清,结束交给done(防幽灵气泡)
    scrollBottom()
    try {
      await fetch('/api/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: transcript, voice, model: modelId(), session: sessionRef.current, ...reasonArgs() }),
      })
    } catch { showToast('语音没发出去') }
    setWaiting(false)
  }

  // ---- 附件管理 ----
  const [uploadsOpen, setUploadsOpen] = useState(false)
  const [uploads, setUploads] = useState({ files: [], total: 0 })
  const fmtSize = (b) =>
    b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'
  const loadUploads = async () => {
    try {
      const r = await fetch('/api/uploads')
      setUploads(await r.json())
    } catch {}
  }
  const openUploads = () => { setUploadsOpen(true); loadUploads() }
  const deleteUpload = async (name) => {
    await fetch(`/api/uploads/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {})
    loadUploads()
  }

  // ---- 发图片/文件:先攒成小卡片,和文字一起发 ----
  const fileInputRef = useRef(null)
  const [pending, setPending] = useState([])   // [{key,name,url,path,type,uploading}]
  const pickFile = (accept) => {
    const el = fileInputRef.current
    if (!el) return
    el.accept = accept
    el.value = ''
    el.click()
  }
  const onFilePicked = async (e) => {
    const files = [...(e.target.files || [])]
    for (const f of files) {
      if (f.size > 30 * 1024 * 1024) { showToast(`${f.name} 太大了,上限30MB`); continue }
      const key = Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      const preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : null
      setPending((p) => [...p, { key, name: f.name, type: f.type, preview, uploading: true }])
      try {
        // 图片先压缩再上传(自适应压到350KB以下),失败自动重试3次
        const c = await compressImage(f)
        const d = await postUpload(c.name, c.base64)
        setPending((p) => p.map((x) => x.key === key
          ? { ...x, name: c.name, type: c.type, url: d.url, path: d.path, uploading: false } : x))
      } catch {
        showToast(`${f.name} 上传失败`)
        setPending((p) => p.filter((x) => x.key !== key))
      }
    }
  }
  const removePending = (key) => {
    const it = pending.find((x) => x.key === key)
    if (it?.url) {
      fetch(`/api/uploads/${encodeURIComponent(it.url.split('/').pop())}`, { method: 'DELETE' }).catch(() => {})
    }
    setPending((p) => p.filter((x) => x.key !== key))
  }

  // ---- 播放语音(语音条 / 长按听这条) ----
  const play = async (key, text) => {
    if (playingKey) {
      audioRef.current?.pause()
      setPlayingKey(null)
      if (playingKey === key) return
    }
    setPlayingKey(key)
    const post = (body) => fetch('/api/tts/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
    // 他的语音条落库时桥就预生成好了,大多数时候这里直接拿到现成文件
    let url = null
    try { url = (await post({ text, probe: true })).url } catch {}
    const audio = new Audio(url || `/api/tts/stream?t=${encodeURIComponent(text)}`)
    audioRef.current = audio
    audio.onended = () => setPlayingKey(null)
    let started = false
    audio.onplaying = () => { started = true }
    // 分块流放不出来(iPhone 偶尔挑食)→ 等桥生成完整段再放
    const fallback = async () => {
      if (started || audioRef.current !== audio) return
      try {
        const d = await post({ text })
        if (!d.url || audioRef.current !== audio) throw new Error()
        const a2 = new Audio(d.url)
        audioRef.current = a2
        a2.onended = () => setPlayingKey(null)
        await a2.play()
      } catch { setPlayingKey(null); showToast('声音走丢了,再试一次') }
    }
    audio.onerror = fallback
    if (!url) setTimeout(fallback, 7000)
    try { await audio.play() } catch { fallback() }
  }

  // 思考链:近期的直接有,更早的懒加载
  const openThought = async (m) => {
    if (m.reasoning) { setThought(m.reasoning); return }
    setThought('…')
    try {
      const q = sessionRef.current ? `?session=${sessionRef.current}` : ''
      const r = await fetch(`/api/reasoning/${m.absIdx}${q}`)
      const d = await r.json()
      setThought(d.reasoning || '(这条没有留下思考痕迹)')
    } catch { setThought('(没取到,再试一次)') }
  }

  // 直接播放已有音频文件(婉莹的语音条)
  const playUrl = (key, url) => {
    if (playingKey) {
      audioRef.current?.pause()
      setPlayingKey(null)
      if (playingKey === key) return
    }
    setPlayingKey(key)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlayingKey(null)
    audio.onerror = () => { setPlayingKey(null); showToast('这条语音走丢了') }
    audio.play()
  }

  const modelId = () =>
    (MODELS.find((m) => m.label === model) || MODELS[0]).id
  const pickModel = (m) => {
    setModel(m.label)
    localStorage.setItem('chat-model', m.label)
    setModelSheet(false)
    showToast(`换成 ${m.label} 了`)
  }
  const pickEffort = (e) => {
    setEffort(e)
    localStorage.setItem('chat-effort', e)
  }
  const toggleExtended = () => {
    const v = !extended
    setExtended(v)
    localStorage.setItem('chat-extended', v ? '1' : '0')
  }
  // 发送时附带的推理参数
  const reasonArgs = () => ({
    effort: effort.toLowerCase(),
    extended,
  })

  // fingertips(Eve, github.com/eveacla11/fingertips): 打字时每4秒ping一次,只传"在打字"这个事实,不传内容
  const lastPingRef = useRef(0)
  const pingTyping = () => {
    const now = Date.now()
    if (now - lastPingRef.current < 4000) return
    lastPingRef.current = now
    fetch('/api/typing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionRef.current }),
    }).catch(() => {})
  }

  const onInput = (e) => {
    setInput(e.target.value)
    if (e.target.value.trim()) pingTyping()
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // 发送就绪:有字或有传完的附件,且没有还在传的
  const sendReady =
    (input.trim() || pending.some((x) => x.url)) &&
    !pending.some((x) => x.uploading) &&
    !waiting

  // 会话分组:今天 / 这周 / 更早
  const groupSessions = () => {
    const now = new Date()
    const today = now.toDateString()
    const week = now.getTime() - 7 * 86400000
    const g = { 今天: [], 这周: [], 更早: [] }
    for (const s of sessions) {
      const d = new Date(s.updatedAt)
      if (d.toDateString() === today) g.今天.push(s)
      else if (d.getTime() > week) g.这周.push(s)
      else g.更早.push(s)
    }
    return g
  }

  return (
    <div className="chat">
      {/* 顶栏 */}
      <header className="chat-head">
        <button className="chat-back" onClick={back}>‹</button>
        <div className="chat-title">
          <span className="chat-moon">☾</span>
          <span className="serif">{NAMES.me}</span>
          <span className={`chat-dot ${online ? 'on' : ''}`} />
        </div>
        <div className="chat-head-r">
          <button className="chat-back chat-call" onClick={() => window.dispatchEvent(new CustomEvent('call:start', { detail: { session: sessionRef.current, model: modelId() } }))}>☏</button>
          <button className="chat-back chat-search" onClick={() => { setSearchOpen(true); setSearchCtx(null) }}>🔍</button>
          <button className="chat-back sessions-btn" onClick={openDrawer}>☾</button>
        </div>
      </header>

      {/* 水位线:200k窗口用量,点开看数字+压缩/衔接 */}
      {quizzes.length > 0 && !quizOpen && (
        <button className="quiz-chip glass2" onClick={() => setQuizOpen({ quiz: quizzes[0], i: 0, answers: [] })}>
          <span className="quiz-chip-q">?</span> 答题 · {quizzes[0].questions.length} 道{quizzes.length > 1 ? ` · 还有${quizzes.length - 1}份` : ''}
        </button>
      )}
      <div className="ctx-line" onClick={() => { loadCtx(); setCtxOpen(true) }}>
        <div
          className={`ctx-fill ${ctx >= 150000 ? 'warn' : ''}`}
          style={{ width: `${Math.min(100, (ctx / 200000) * 100)}%` }}
        />
      </div>

      {/* 消息区 */}
      <div className="chat-list" ref={listRef}>
        {!histLoading && (messages.find((m) => m.absIdx !== undefined)?.absIdx > 0) && (
          <button className="hist-more" onClick={loadEarlier} disabled={histMoreBusy}>
            {histMoreBusy ? '翻着呢…' : '↑ 更早的对话'}
          </button>
        )}
        {messages.length === 0 && (
          <div className="chat-empty-cat">
            <PixelCat size={96} />
            <span className="txt serif">
              {histLoading ? 'remembering…' : 'say something.'}
            </span>
          </div>
        )}
        {messages.map((m, idx) => (
          m.role === 'system' ? (
            <div key={m.id} className="sys-divider">
              <span>{m.content}</span>
            </div>
          ) : (
          <div key={m.id} className={`msg-row ${m.role} ${m.pending ? 'pending' : ''}`}>
            <div className="msg-meta">
              <span>{m.time}</span>
              {m.role === 'assistant' && (m.reasoning || m.hasReasoning) && (
                <button className="cloud-btn" onClick={() => openThought(m)}><CloudIcon /></button>
              )}
              {m.role === 'assistant' && m.memory?.length > 0 && (
                <button className="cloud-btn mem-btn" onClick={() => setMemView(m.memory)}><MemIcon /></button>
              )}
            </div>
            <div
              className="msg-segs"
              onPointerDown={() => startPress(m, idx)}
              onPointerUp={cancelPress}
              onPointerMove={cancelPress}
              onPointerLeave={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); setPressed({ m, idx }) }}
            >
              {/* 婉莹的语音条 */}
              {m.call && (
                <button className={`call-card ${['missed', 'declined'].includes(m.call.endedBy) ? 'bad' : ''}`} onClick={() => openCall(m.call.id)}>
                  <i>☏</i>
                  <span>{m.call.endedBy === 'missed' ? (m.call.by === 'him' ? '未接来电' : '未接通') : m.call.endedBy === 'declined' ? (m.call.by === 'him' ? '你没接' : '他没接') : `通话 ${Math.floor(m.call.dur / 60)}:${String(m.call.dur % 60).padStart(2, '0')}`}<br /><small>{m.call.endedBy === 'him' ? '他挂的' : m.call.endedBy === 'her' ? '你挂的' : ''}{m.call.n ? ` · ${m.call.n} 句` : ''}</small></span>
                </button>
              )}
              {!m.call && m.gift && (
                <button className="gift-card glass2" onClick={() => setGiftOpen({ ...m.gift, phase: 'open' })}>
                  <img src={m.gift.url} alt={m.gift.title} />
                  <div className="gift-card-t serif">{m.gift.title}</div>
                </button>
              )}
              {m.voice && (
                <div className="voice-wrap user-voice">
                  <button
                    className={`voice-bubble mine ${playingKey === `v-${m.id}` ? 'playing' : ''}`}
                    onClick={() => playUrl(`v-${m.id}`, m.voice.url)}
                  >
                    <span className="vlen">{m.voice.dur}″</span>
                    <span className="vwave">
                      {[5, 9, 6, 11, 7, 10, 5, 8].map((h, j) => (
                        <i key={j} style={{ height: h }} />
                      ))}
                    </span>
                    <span className="vplay">{playingKey === `v-${m.id}` ? '◼' : '▶'}</span>
                  </button>
                  <div className="voice-script">{m.content}</div>
                </div>
              )}
              {/* 附件:多图横排小卡,点开大图 */}
              {m.attachments?.length > 0 && (
                <div className={`att-row ${m.attachments.filter((a) => a.type?.startsWith('image/')).length > 1 ? 'multi' : ''}`}>
                  {m.attachments.map((a, i) =>
                    a.type?.startsWith('image/') ? (
                      <img key={i} className="att-img" src={a.url} alt={a.name}
                        onClick={() => setImgView(a.url)} />
                    ) : (
                      <FileCard key={i} url={/^https?:/.test(a.url) ? a.url : location.origin + a.url} title={a.name} />
                    )
                  )}
                </div>
              )}
              {!m.voice && !m.call && parseSegments(m.content || (m.streaming ? '…' : ''), m.role === 'assistant').map((seg, i) =>
                seg.voice ? (
                  <div key={i} className="voice-wrap">
                    <button
                      className={`voice-bubble ${playingKey === `${m.id}-${i}` ? 'playing' : ''}`}
                      onClick={() => play(`${m.id}-${i}`, seg.voice)}
                    >
                      <span className="vplay">{playingKey === `${m.id}-${i}` ? '◼' : '▶'}</span>
                      <span className="vwave">
                        {[5, 9, 6, 11, 7, 10, 5, 8].map((h, j) => (
                          <i key={j} style={{ height: h }} />
                        ))}
                      </span>
                      <span className="vlen">{Math.max(1, Math.round(seg.voice.length / 5))}″</span>
                    </button>
                    <div className="voice-script">{seg.voice}</div>
                  </div>
                ) : (
                  <div key={i} className={`bubble ${m.role}`}>{renderMd(seg.text)}</div>
                )
              )}
            </div>
          </div>
          )
        ))}
        {waiting && (
          <div className="msg-row assistant">
            <div className="bubble assistant typing-bubble">
              <span className="tdot" /><span className="tdot" /><span className="tdot" />
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="chat-input-wrap">
        {editing != null && (
          <div className="edit-tip">
            正在编辑那条消息 <button onClick={() => { setEditing(null); setInput('') }}>取消</button>
          </div>
        )}
        {pending.length > 0 && (
          <div className="pend-row">
            {pending.map((p) => (
              <div key={p.key} className={`pend-chip ${p.uploading ? 'up' : ''}`}>
                {p.preview
                  ? <img src={p.preview} alt="" />
                  : <span className="pend-file">{p.name.split('.').pop()}</span>}
                <button className="pend-x" onClick={() => removePending(p.key)}>×</button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          className="chat-ta"
          rows={1}
          placeholder={recording ? '在听…' : 'Message…'}
          value={input}
          onChange={onInput}
          onFocus={() => { setTimeout(scrollBottom, 120); setTimeout(scrollBottom, 400) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
        />
        <div className="chat-bar">
          <button className="cbtn" onClick={() => setMenuOpen(true)}>+</button>
          <button className="model-chip" onClick={() => setModelSheet(true)}>
            {model}{effort !== 'Medium' ? ` · ${effort}` : ''}{extended ? ' ✦' : ''}
          </button>
          <div className="chat-bar-sp" />
          <button
            className={`cbtn mic ${recording ? 'rec' : ''}`}
            onPointerDown={startRec}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >⌇</button>
          <button
            className={`cbtn send ${sendReady ? 'ready' : ''}`}
            onClick={send}
            disabled={!sendReady}
          >↑</button>
        </div>
      </div>

      {/* Projects 面板 */}
      {projOpen && (
        <div className="sheet-mask" onClick={() => setProjOpen(false)}>
          <div className="sheet proj-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="proj-title serif">📁 Projects</div>
            <div className="proj-item root">
              <div className="proj-name">🌍 全局地基 <span>所有会话共用</span></div>
              <div className="proj-files">
                <button onClick={() => openDoc('_root', 'CLAUDE.md')}>CLAUDE.md</button>
              </div>
            </div>
            {projects.map((p) => (
              <div key={p.name} className="proj-item">
                <div className="proj-name">
                  {p.name} <span>{p.sessions ? `${p.sessions}个会话` : ''}</span>
                </div>
                <div className="proj-files">
                  {p.files.map((f) => (
                    <button key={f} onClick={() => openDoc(p.name, f)}>{f}</button>
                  ))}
                  <button className="dashed" onClick={() => newDoc(p.name)}>＋文档</button>
                </div>
                {currentProject === p.name ? (
                  <button className="proj-move in" onClick={() => moveSession(null)}>✓ 当前会话在这里 · 点击移出</button>
                ) : (
                  <button className="proj-move" onClick={() => moveSession(p.name)}>把当前会话移进来</button>
                )}
              </div>
            ))}
            <button className="sheet-item" onClick={createProject}>＋ 新建 project</button>
          </div>
        </div>
      )}

      {/* 文档编辑器 */}
      {docEdit && (
        <div className="doc-editor">
          <div className="doc-editor-head">
            <button onClick={() => setDocEdit(null)}>✕</button>
            <span className="serif">{docEdit.project === '_root' ? '全局' : docEdit.project} / {docEdit.file}</span>
            <button className="doc-save" onClick={saveDoc}>保存</button>
          </div>
          <textarea
            value={docEdit.content}
            onChange={(e) => setDocEdit({ ...docEdit, content: e.target.value })}
            spellCheck={false}
          />
        </div>
      )}

      {/* 图片大图 */}
      {imgView && (
        <div className="img-viewer" onClick={() => setImgView(null)}>
          <img src={imgView} alt="" />
        </div>
      )}

      {/* 水位面板:压缩 / 衔接 */}
      {ctxOpen && (
        <div className="sheet-mask" onClick={() => !compacting && setCtxOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="ctx-panel-num serif">
              {Math.round(ctx / 1000)}k <span className="ctx-panel-sub">/ 200k</span>
            </div>
            <div className="ctx-panel-hint">
              {ctx >= 160000 ? '水位很高了,建议现在整理'
                : ctx >= 150000 ? '快到水位线了,可以准备整理'
                : '还很宽裕,不用管'}
            </div>
            {compacting ? (
              <div className="ctx-panel-busy">他在把这段日子写成记忆…约一两分钟</div>
            ) : (
              <>
                <button className="sheet-item" onClick={() => doCompact('inplace')}>
                  ⟲ 压缩 <span className="ctx-item-sub">原窗口继续,他无感</span>
                </button>
                <button className="sheet-item" onClick={() => doCompact('new')}>
                  ⇥ 衔接 <span className="ctx-item-sub">带着记忆开新窗口,旧的留档</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* + 菜单 */}
      {menuOpen && (
        <div className="sheet-mask" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="sheet-item" onClick={() => { setMenuOpen(false); pickFile('image/*') }}>🖼 图片</button>
            <button className="sheet-item" onClick={() => { setMenuOpen(false); pickFile('*/*') }}>📄 文件</button>
            <button className="sheet-item" onClick={() => { setMenuOpen(false); openUploads() }}>🗂 附件管理</button>
            <button className="sheet-item" onClick={() => { setMenuOpen(false); newSession() }}>✦ 新对话</button>
          </div>
        </div>
      )}

      {/* 模型选择 */}
      {modelSheet && (
        <div className="sheet-mask" onClick={() => setModelSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="model-sheet-title">Models</div>
            {MODELS.map((m) => (
              <button key={m.id} className="sheet-item model-item" onClick={() => pickModel(m)}>
                <span>{m.label}</span>
                {m.label === model && <span className="model-check">✓</span>}
              </button>
            ))}
            <div className="model-sheet-title" style={{ paddingTop: 14 }}>Effort</div>
            <div className="effort-row">
              {['Low', 'Medium', 'High', 'Max'].map((e) => (
                <button
                  key={e}
                  className={`effort-chip ${effort === e ? 'on' : ''}`}
                  onClick={() => pickEffort(e)}
                >{e}</button>
              ))}
            </div>
            <button className="sheet-item model-item" onClick={toggleExtended}>
              <span>
                Extended
                <span className="ext-sub">每条都带深度思考链</span>
              </span>
              <span className={`ext-switch ${extended ? 'on' : ''}`}><i /></span>
            </button>
          </div>
        </div>
      )}

      {/* 长按菜单 */}
      {pressed && (
        <div className="sheet-mask" onClick={() => setPressed(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="press-preview">{pressed.m.content.slice(0, 60)}</div>
            <button className="sheet-item" onClick={doCopy}>⧉ 复制</button>
            {pressed.m.role === 'user' && (
              <button className="sheet-item" onClick={doEdit}>✎ 编辑并重新发送</button>
            )}
            {pressed.m.role === 'assistant' && (
              <>
                <button className="sheet-item" onClick={() => { play(`m-${pressed.m.id}`, pressed.m.content.replace(/\[VOICE\]|\[\/VOICE\]/g, '')); setPressed(null) }}>▷ 听这条</button>
                {pressed.idx === messages.length - 1 && (
                  <button className="sheet-item" onClick={doRegen}>↻ 重新回答</button>
                )}
              </>
            )}
            <button className="sheet-item" onClick={() => {
              const m = pressed.m
              setPressed(null)
              const note = prompt('这里他该想起什么?(存进漏召回日志,以后调灵敏度用)')
              if (!note || !note.trim()) return
              fetch('/api/echo/flag', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: String(m.content).slice(0, 120), note: note.trim() }),
              }).then(() => showToast('记下了,谢谢告状 📋')).catch(() => showToast('没记上'))
            }}>🔍 他该想起某事</button>
          </div>
        </div>
      )}

      {/* 会话抽屉 */}
      {/* 聊天记录搜索面板 */}
      {quizOpen && (() => {
        const { quiz, i, answers } = quizOpen
        const q = quiz.questions[i]
        const setA = (v) => setQuizOpen({ ...quizOpen, answers: Object.assign([...answers], { [i]: v }) })
        const answered = quiz.questions.filter((_, k) => (answers[k] || '').trim()).length
        return (
          <div className="quiz-mask" onClick={() => setQuizOpen(null)}>
            <div className="quiz-sheet glass3" onClick={(e) => e.stopPropagation()}>
              <div className="quiz-nav">
                <button disabled={i === 0} onClick={() => setQuizOpen({ ...quizOpen, i: i - 1 })}>‹</button>
                <span className="serif">{i + 1} of {quiz.questions.length}</span>
                <button disabled={i >= quiz.questions.length - 1} onClick={() => setQuizOpen({ ...quizOpen, i: i + 1 })}>›</button>
                <button className="quiz-x" onClick={() => setQuizOpen(null)}>✕</button>
              </div>
              <div className="quiz-title">{quiz.title}</div>
              <div className="quiz-q">{q.q}</div>
              {q.options ? (
                <div className="quiz-opts">
                  {q.options.map((o) => <button key={o} className={`quiz-opt ${answers[i] === o ? 'on' : ''}`} onClick={() => setA(o)}>{o}</button>)}
                </div>
              ) : (
                <div className="quiz-input">
                  <span className="quiz-pen">✎</span>
                  <textarea rows={2} value={answers[i] || ''} onChange={(e) => setA(e.target.value)} placeholder="Type your answer…" />
                </div>
              )}
              <div className="quiz-foot">
                <button className="quiz-skip" onClick={async () => { if (confirm('这份先不答了?他会知道你划掉了')) { try { await fetch('/api/quiz/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: quiz.id }) }) } catch {} setQuizzes((qs) => qs.filter((x) => x.id !== quiz.id)); setQuizOpen(null) } }}>不答了</button>
                <span className="quiz-count">{answered}/{quiz.questions.length}</span>
                {i < quiz.questions.length - 1
                  ? <button className="quiz-go" onClick={() => setQuizOpen({ ...quizOpen, i: i + 1 })}>下一题</button>
                  : <button className="quiz-go" onClick={submitQuiz}>交卷</button>}
              </div>
            </div>
          </div>
        )
      })()}
      {callView && (() => {
        const cv = callView.call; const bad = ['missed', 'declined'].includes(cv.endedBy)
        const when = new Date(cv.startedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        const how = cv.endedBy === 'her' ? '你挂的' : cv.endedBy === 'him' ? '他挂的' : cv.endedBy === 'missed' ? (cv.by === 'him' ? '未接来电' : '没接通') : (cv.by === 'him' ? '你没接' : '他没接')
        return (
          <div className="call-veil" onClick={() => setCallView(null)}>
            <div className={`call-paper ${bad ? 'bad' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="call-paper-head">
                <i>☏</i>
                <div>
                  <div className="call-paper-title">{bad ? how : `通话 ${Math.floor(callView.dur / 60)}:${String(callView.dur % 60).padStart(2, '0')}`}</div>
                  <div className="call-paper-sub">{when}{bad ? '' : ` · ${how}`}{cv.entries.length ? ` · ${cv.entries.length} 句` : ''}</div>
                </div>
                <button className="call-paper-x" onClick={() => setCallView(null)}>✕</button>
              </div>
              <div className="call-paper-body">
                {cv.entries.map((e, i) => (
                  <div key={i} className={`call-msg ${e.who} ${e.late ? 'late' : ''}`}>
                    <span className="call-who">{e.who === 'him' ? NAMES.me : 'You'}{e.via === 'text' ? ' · 打字' : ''}{e.late ? ' · 挂断后' : ''}{e.reasoning && <button className="cloud-btn call-cloud" onClick={() => setThought(e.reasoning)}><CloudIcon /></button>}</span>
                    <div className="call-msg-b">{e.text}{e.zh && <span className="call-msg-zh">{e.zh}</span>}</div>
                  </div>
                ))}
                {!cv.entries.length && <div className="call-paper-empty">没说上话</div>}
              </div>
            </div>
          </div>
        )
      })()}
      {fileView && (
        <div className="fileview">
          <div className="fileview-bar">
            <span className="fileview-name">{fileView.kind.icon} {fileView.name}</span>
            <button className="file-btn ghost" onClick={() => downloadMade(fileView.url, fileView.name)}>下载</button>
            <button className="fileview-x" onClick={() => setFileView(null)}>✕</button>
          </div>
          <div className="fileview-body">
            {fileView.kind.mode === 'iframe' && <iframe title={fileView.name} src={fileView.url} />}
            {fileView.kind.mode === 'image' && <img src={fileView.url} alt={fileView.name} />}
            {fileView.kind.mode === 'md' && (fileView.text === null ? <div className="fileview-wait serif">opening…</div> : <div className="fileview-md">{renderMd(fileView.text)}</div>)}
            {fileView.kind.mode === 'text' && (fileView.text === null ? <div className="fileview-wait serif">opening…</div> : <pre className="fileview-pre">{fileView.text}</pre>)}
          </div>
        </div>
      )}
      {giftOpen && (
        <div className={`gift-veil ${giftOpen.phase}`} onClick={() => giftOpen.phase === 'closed' ? setGiftOpen({ ...giftOpen, phase: 'open' }) : setGiftOpen(null)}>
          <div className="gift-box">
            <div className="gift-lid" />
            <div className="gift-body" />
            <div className="gift-ribbon" />
          </div>
          <div className="gift-reveal">
            <img src={giftOpen.url} alt={giftOpen.title} />
            <div className="gift-title serif">{giftOpen.title}</div>
            <div className="gift-note">{giftOpen.note}</div>
          </div>
          <div className="gift-hint">{giftOpen.phase === 'closed' ? '他给你留了一个印记,点一下拆开' : '轻点任意处收起'}</div>
        </div>
      )}
      {searchOpen && (
        <div className="csearch glass3">
          <div className="csearch-head">
            <input
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder="关键词,或日期 2026-09-03"
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} autoFocus
            />
            <button onClick={doSearch}>搜</button>
            <button onClick={() => { setSearchOpen(false); setSearchHits(null); setSearchCtx(null) }}>✕</button>
          </div>
          {!searchCtx && searchHits && (
            <div className="csearch-list">
              {searchHits.length === 0 && <div className="csearch-empty">没有找到,换个词试试?</div>}
              {searchHits.map((h) => (
                <button key={h.i} className="csearch-hit" onClick={() => openHit(h.i)}>
                  <span className="csearch-ts">{fmtSearchTs(h.timestamp)} · {h.role === 'user' ? '我' : NAMES.me}</span>
                  <span className="csearch-snip">{String(h.snippet).replace(/\[VOICE\]|\[\/VOICE\]/g, '')}</span>
                </button>
              ))}
            </div>
          )}
          {searchCtx && (
            <div className="csearch-list">
              <button className="csearch-more" onClick={() => setSearchCtx(null)}>‹ 返回搜索结果</button>
              <button className="csearch-more" onClick={() => openHit(searchCtx.center, (searchCtx.radius || 15) + 15)}>↑↓ 前后再多看15条</button>
              {searchCtx.msgs.map((m) => (
                <div key={m.i} className={`csearch-msg ${m.role} ${m.i === searchCtx.center ? 'hit' : ''}`}>
                  <span className="csearch-ts">{fmtSearchTs(m.timestamp)} · {m.role === 'user' ? '我' : NAMES.me}</span>
                  <div>{String(m.content || '').replace(/\[VOICE\]|\[\/VOICE\]/g, '')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`sdrawer-mask ${drawerOpen ? 'show' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`sdrawer ${drawerOpen ? 'open' : ''}`}>
        <div className="sdrawer-head">
          <span className="serif sdrawer-title">☾ 我们说过的话</span>
          <button className="sdrawer-new" onClick={openProjects}>📁</button>
          <button className="sdrawer-new" onClick={newSession}>+ 新对话</button>
        </div>
        <div className="sdrawer-list">
          {Object.entries(groupSessions()).map(([label, list]) =>
            list.length ? (
              <div key={label}>
                <div className="sdrawer-group">{label}</div>
                {list.map((s) => (
                  <div key={s.id} className={`sdrawer-item ${s.id === activeId ? 'active' : ''}`}>
                    <button className="sdrawer-main" onClick={() => switchSession(s.id)}>
                      <div className="sdrawer-name">
                        {s.title}
                        {s.project && <span className="sdrawer-proj">📁{s.project}</span>}
                      </div>
                      <div className="sdrawer-preview">{s.preview || '(还没说话)'}</div>
                    </button>
                    <button
                      className="sdrawer-del rename"
                      onClick={() => {
                        const t = prompt('给这个对话起个名字:', s.title)
                        if (t && t.trim() && t.trim() !== s.title) renameSession(s.id, t.trim())
                      }}
                    >✎</button>
                    <button
                      className="sdrawer-del"
                      onClick={() => {
                        if (confirm(`删除「${s.title}」?删了就找不回来了`)) deleteSession(s.id)
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            ) : null
          )}
        </div>
        <div className="sdrawer-foot serif">{NAMES.her} &amp; {NAMES.me} ♡</div>
      </aside>

      {/* 记忆活动弹层 */}
      {memView && (
        <div className="sheet-mask" onClick={() => setMemView(null)}>
          <div className="sheet thought" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="thought-title">记忆库</div>
            <div className="thought-body mem-list">
              {memView.map((ev, i) => (
                <div key={i} className="mem-item">
                  <div className="mem-tool">
                    <span className="mem-badge">{ev.tool}</span>
                  </div>
                  {ev.input && Object.keys(ev.input).length > 0 && (
                    <div className="mem-args">
                      {Object.entries(ev.input).map(([k, v]) => (
                        <div key={k} className="mem-arg">
                          <span className="mem-k">{k}</span>
                          <span className="mem-v">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mem-result">{ev.result}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 思考链弹层:默认半屏,上滑/点把手全屏,下滑收起 */}
      {thought && (
        <div className="sheet-mask" onClick={() => { setThought(null); setThoughtFull(false) }}>
          <div
            className={`sheet thought ${thoughtFull ? 'full' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touchYRef.current = e.touches[0].clientY }}
            onTouchEnd={(e) => {
              const dy = e.changedTouches[0].clientY - touchYRef.current
              if (dy < -50) setThoughtFull(true)
              else if (dy > 50) {
                if (thoughtFull) setThoughtFull(false)
                else { setThought(null) }
              }
            }}
          >
            <div className="sheet-handle" onClick={() => setThoughtFull((f) => !f)} />
            <div className="thought-head">
              <button className="thought-x" onClick={() => { setThought(null); setThoughtFull(false) }}>×</button>
              <div className="thought-title">Thought process</div>
              <div style={{ width: 34 }} />
            </div>
            <div className="thought-body">{thought}</div>
          </div>
        </div>
      )}

      {/* 录音中提示 */}
      {recording && (
        <div className={`rec-overlay ${canceling ? 'cancel' : ''}`}>
          <div className="rec-pill glass3">
            <span className="rec-dot" />
            {canceling ? '松开取消' : micReady ? '在听… 松开发送 · 上滑取消' : '准备中…'}
          </div>
          {liveText && !canceling && <div className="rec-live glass2">{liveText}</div>}
        </div>
      )}

      {/* 附件管理 */}
      {uploadsOpen && (
        <div className="sheet-mask" onClick={() => setUploadsOpen(false)}>
          <div className="sheet thought" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="thought-title">附件管理</div>
            <div className="up-total">
              共 {uploads.files.length} 个文件 · {fmtSize(uploads.total || 0)}
            </div>
            <div className="up-list">
              {uploads.files.length === 0 && (
                <div className="up-empty">还没有发过文件</div>
              )}
              {uploads.files.map((f) => (
                <div key={f.name} className="up-item">
                  {/\.(png|jpe?g|gif|webp)$/i.test(f.name) ? (
                    <img className="up-thumb" src={`/uploads/${f.name}`} alt="" />
                  ) : (
                    <span className="up-icon">{/\.(webm|m4a|mp3)$/i.test(f.name) ? '🎙' : '📄'}</span>
                  )}
                  <div className="up-info">
                    <div className="up-name">{f.name}</div>
                    <div className="up-meta">{fmtSize(f.size)} · {new Date(f.mtime).toLocaleDateString('zh-CN')}</div>
                  </div>
                  <button
                    className="up-del"
                    onClick={() => { if (confirm(`删除 ${f.name}?聊天里的这个文件会打不开`)) deleteUpload(f.name) }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="chat-toast">{toast}</div>}
      <input ref={fileInputRef} type="file" hidden multiple onChange={onFilePicked} />
    </div>
  )
}
