import { useEffect, useRef, useState } from 'react'
import './read.css'

// Read · 一起看书(晋江式阅读器)
// 翻页/滚动双模式;☰章节目录(已读标记/按章看提要);长按段落写段评;🖊气泡数字
export default function Read({ back }) {
  const [books, setBooks] = useState(null)
  const [cur, setCur] = useState(null)
  const [loading, setLoading] = useState(false)
  const [annOpen, setAnnOpen] = useState(null)
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const [pickOwner, setPickOwner] = useState(null)
  const [sessions, setSessions] = useState([])
  const [drawer, setDrawer] = useState(false)
  const [noteView, setNoteView] = useState(null)   // {title, note}
  const [mode, setMode] = useState(() => localStorage.getItem('read-mode') || 'page')
  const fileRef = useRef(null)
  const pageRef = useRef(null)
  const fracRef = useRef(0)
  const [flowW, setFlowW] = useState(0)
  const [pctTick, setPctTick] = useState(0)

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 2200) }

  const loadBooks = async () => {
    try { setBooks((await (await fetch('/api/read/books')).json()).books || []) } catch {}
  }
  useEffect(() => { loadBooks() }, [])

  // 提要还在后台生成时,书架每15秒自己刷新一次进度
  useEffect(() => {
    if (!books || cur) return
    if (books.some((b) => (b.notesDone || 0) < b.chapters.length)) {
      const t = setTimeout(loadBooks, 15000)
      return () => clearTimeout(t)
    }
  }, [books, cur])

  // ---- 传书(切片) ----
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const r = await fetch('/api/sessions')
      const d = await r.json()
      setSessions(d.sessions || [])
    } catch {}
    setPickOwner({ file: f })
    e.target.value = ''
  }
  const [uploading, setUploading] = useState(null)
  const doUpload = async (owner) => {
    const f = pickOwner.file
    setPickOwner(null)
    setUploading({ name: f.name.replace(/\.(txt|md)$/i, ''), pct: 0 })
    try {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result.split(',')[1])
        fr.onerror = reject
        fr.readAsDataURL(f)
      })
      const CHUNK = 256 * 1024
      const total = Math.ceil(b64.length / CHUNK)
      const uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const postJson = async (path, body) => {
        for (let t = 0; t < 3; t++) {
          try {
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), 20000)
            const r = await fetch(path, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body), signal: ctrl.signal,
            })
            clearTimeout(timer)
            if (r.ok) return await r.json()
            if (t === 2) throw new Error((await r.json().catch(() => ({}))).error || 'http ' + r.status)
          } catch (e2) { if (t === 2) throw e2 }
          await new Promise((res) => setTimeout(res, 700 * (t + 1)))
        }
      }
      for (let i = 0; i < total; i++) {
        await postJson('/api/read/upload-chunk', { uid, seq: i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) })
        setUploading((u) => u && { ...u, pct: Math.round(((i + 1) / total) * 100) })
      }
      const d = await postJson('/api/read/upload-finish', { uid, name: f.name, owner, total })
      setUploading(null)
      flash(`上架了,共${d.chapters}章 📜提要开始后台生成`)
      loadBooks()
    } catch (e) {
      setUploading(null)
      flash(e.message || '没传上')
    }
  }

  // ---- 打开章节 ----
  const openChapter = async (id, n) => {
    setLoading(true)
    setDrawer(false)
    try {
      const d = await (await fetch(`/api/read/chapter?id=${id}&n=${n}`)).json()
      setCur(d)
      setAnnOpen(null)
      fracRef.current = 0
      requestAnimationFrame(() => {
        const el = pageRef.current
        if (el) { el.scrollTop = 0; el.scrollLeft = 0 }
      })
      fetch('/api/read/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, chapter: n, frac: 0 }),
      }).catch(() => {})
    } catch { flash('翻不开这一章') }
    setLoading(false)
  }
  const openBook = (b) => openChapter(b.id, b.progress?.chapter || 1)

  // 翻页模式:测量页宽
  useEffect(() => {
    if (!cur) return
    const el = pageRef.current
    if (el) setFlowW(el.clientWidth - 44)
  }, [cur, mode])

  // ---- 进度 ----
  const progressTimer = useRef(null)
  const reportProgress = () => {
    clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      if (!cur) return
      fetch('/api/read/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cur.id, chapter: cur.chapter, frac: fracRef.current }),
      }).catch(() => {})
    }, 1500)
  }
  const onScroll = () => {
    const el = pageRef.current
    if (!el || !cur) return
    const frac = mode === 'page'
      ? el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)
      : el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
    fracRef.current = Math.max(0, Math.min(1, frac))
    setPctTick((t) => t + 1)
    reportProgress()
  }

  // ---- 翻页手势 ----
  const suppressClick = useRef(false)
  const flip = (dir) => {
    const el = pageRef.current
    if (!el) return
    el.scrollBy({ left: dir * (flowW + 44), behavior: 'smooth' })
  }
  const onPageTap = (e) => {
    if (mode !== 'page') return
    if (suppressClick.current) { suppressClick.current = false; return }
    if (annOpen) { setAnnOpen(null); return }
    const rect = pageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width * 0.35) flip(-1)
    else flip(1)
  }

  // 长按段落=写段评
  const pressT = useRef(null)
  const startPara = (i) => {
    clearTimeout(pressT.current)
    pressT.current = setTimeout(() => {
      suppressClick.current = true
      setAnnOpen({ para: i })
      if (navigator.vibrate) navigator.vibrate(10)
    }, 450)
  }
  const cancelPara = () => clearTimeout(pressT.current)

  // ---- 批注 ----
  const annsOf = (para) => (cur?.ann || []).filter((a) => a.para === para)
  const sendAnn = async (para, annId, text) => {
    const body = text || draft.trim()
    if (!body) return
    const anchor = annId ? '' : (cur.paras[para] || '').slice(0, 40)
    try {
      const r = await fetch('/api/read/annotate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cur.id, ch: cur.chapter, para, anchor, text: body,
          ...(annId ? { ann: annId } : {}),
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setCur((c) => ({ ...c, ann: d.ann }))
        setDraft('')
        flash('写下了 🖊 记得在聊天里叫他来看')
      }
    } catch { flash('没写上') }
  }

  // ---- 按章看提要 ----
  const openNote = async (n, title) => {
    try {
      const d = await (await fetch(`/api/read/notes?id=${cur.id}&upto=${n}`)).json()
      const it = (d.notes || []).find((x) => x.n === n)
      setNoteView({ title, note: it?.note || '(这一章的提要还在路上,晚点再来看)' })
    } catch {}
  }

  // ================= 书架 =================
  if (!cur) {
    return (
      <div className="page read">
        <header className="read-head">
          <button className="stub-back" onClick={back}>‹</button>
          <div>
            <div className="serif read-title">Read</div>
            <div className="read-sub serif">read together, slowly</div>
          </div>
          <button className="read-add" onClick={() => fileRef.current?.click()}>＋</button>
        </header>
        <input ref={fileRef} type="file" accept=".txt,.md" hidden onChange={onFile} />

        <div className="read-shelf">
          {uploading && (
            <div className="read-book glass1 read-uploading">
              <div className="read-book-title serif">{uploading.name}</div>
              <div className="read-book-meta">上传中 {uploading.pct}%{uploading.pct >= 100 ? ' · 拆章中…' : ''}</div>
              <div className="read-book-bar"><i style={{ width: `${uploading.pct}%` }} /></div>
            </div>
          )}
          {books === null && <div className="read-empty serif">书架搬运中…</div>}
          {books?.length === 0 && !uploading && (
            <div className="read-empty serif">书架还空着。<br />右上角＋,放一本你们的书。</div>
          )}
          {books?.map((b) => (
            <button key={b.id} className="read-book glass1" onClick={() => openBook(b)}>
              <div className="read-book-title serif">{b.title}</div>
              <div className="read-book-meta">
                {b.ownerTitle ? `和${b.ownerTitle}` : '还没认领'} · 第{b.progress?.chapter || 1}/{b.chapters.length}章
                {b.pending > 0 && <span className="read-pend"> · {b.pending}条纸条待回</span>}
                {b.notesDone < b.chapters.length && (
                  <span className="read-notesgen"> · 📜提要 {b.notesDone}/{b.chapters.length}</span>
                )}
              </div>
              <div className="read-book-bar"><i style={{ width: `${Math.round(((b.progress?.chapter || 1) - 1 + (b.progress?.frac || 0)) / b.chapters.length * 100)}%` }} /></div>
            </button>
          ))}
        </div>

        {pickOwner && (
          <div className="sheet-mask" onClick={() => setPickOwner(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="read-pick-title serif">《{pickOwner.file.name.replace(/\.(txt|md)$/i, '')}》和谁一起看?</div>
              {sessions.map((s) => (
                <button key={s.id} className="sheet-item" onClick={() => doUpload(s.id)}>{s.title}</button>
              ))}
            </div>
          </div>
        )}
        {toast && <div className="chat-toast">{toast}</div>}
      </div>
    )
  }

  // ================= 阅读 =================
  const pct = Math.round(((cur.chapter - 1 + fracRef.current) / cur.total) * 100)
  const isPaged = mode === 'page'
  return (
    <div className="page read reading">
      <header className="read-toolbar glass3">
        <button className="stub-back" onClick={() => { setCur(null); loadBooks() }}>‹</button>
        <div className="read-toolbar-mid">
          <div className="read-tb-title serif">{cur.title}</div>
          <div className="read-tb-ch">{cur.chapterTitle}</div>
        </div>
        <button className="read-notes-btn" onClick={() => setDrawer(true)}>☰</button>
        <div className="read-tb-pct">{pct}%</div>
      </header>
      <div className="read-progress"><i style={{ width: `${pct}%` }} /></div>

      <div
        className={`read-page ${isPaged ? 'paged' : ''}`}
        ref={pageRef}
        onScroll={onScroll}
        onClick={onPageTap}
      >
        <div className="read-flow" style={isPaged && flowW ? { columnWidth: flowW + 'px', columnGap: '44px', height: '100%' } : undefined}>
          {loading && <div className="read-empty serif">翻页中…</div>}
          {cur.paras.map((p, i) => {
            const anns = annsOf(i)
            return (
              <p key={i} className={`read-para ${anns.length ? 'has-ann' : ''}`}
                onPointerDown={() => startPara(i)}
                onPointerUp={cancelPara}
                onPointerMove={cancelPara}
                onContextMenu={(e) => e.preventDefault()}>
                {p}
                {anns.length > 0 && (
                  <span
                    className={`read-pin ${anns.some((a) => a.who === 'ayan' || (a.replies || []).some((r) => r.who === 'ayan')) ? 'his' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setAnnOpen({ para: i }) }}
                  >{anns.reduce((s, a) => s + 1 + (a.replies || []).length, 0)}</span>
                )}
              </p>
            )
          })}
          <div className="read-chnav" onClick={(e) => e.stopPropagation()}>
            {cur.chapter > 1 && (
              <button onClick={() => openChapter(cur.id, cur.chapter - 1)}>‹ 上一章</button>
            )}
            {cur.chapter < cur.total && (
              <button onClick={() => openChapter(cur.id, cur.chapter + 1)}>下一章 ›</button>
            )}
            {cur.chapter === cur.total && <span className="read-fin serif">— 到这里就读完了 —</span>}
          </div>
        </div>
      </div>

      {/* 章节目录侧栏 */}
      {drawer && (
        <div className="sheet-mask" onClick={() => setDrawer(false)}>
          <aside className="read-drawer glass3" onClick={(e) => e.stopPropagation()}>
            <div className="read-drawer-head serif">{cur.title}</div>
            <div className="read-drawer-list">
              {(cur.chapters || []).map((c) => {
                const state = c.n < cur.progress.chapter ? 'done' : c.n === cur.progress.chapter ? 'now' : ''
                return (
                  <div key={c.n} className={`read-dr-row ${state} ${c.n === cur.chapter ? 'here' : ''}`}>
                    <button className="read-dr-title" onClick={() => openChapter(cur.id, c.n)}>
                      {c.title}
                      {state === 'done' && <span className="read-dr-tag">已读</span>}
                      {state === 'now' && <span className="read-dr-tag now">在读</span>}
                    </button>
                    {c.n <= cur.progress.chapter && (
                      <button className="read-dr-note" onClick={() => openNote(c.n, c.title)}>📜</button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="read-drawer-foot">
              <button onClick={() => {
                const next = isPaged ? 'scroll' : 'page'
                setMode(next)
                localStorage.setItem('read-mode', next)
                setDrawer(false)
              }}>{isPaged ? '↕ 换成滚动模式' : '⇆ 换成翻页模式'}</button>
              <button onClick={async () => {
                await fetch('/api/read/progress', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: cur.id, chapter: cur.chapter, frac: 0, force: true }),
                }).catch(() => {})
                setCur((c) => ({ ...c, progress: { chapter: c.chapter, frac: 0 } }))
                setDrawer(false)
                flash(`进度校正到${cur.chapterTitle}`)
              }}>📍 进度校正到本章</button>
            </div>
          </aside>
        </div>
      )}

      {/* 单章提要 */}
      {noteView && (
        <div className="sheet-mask" onClick={() => setNoteView(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="read-pick-title serif">📜 {noteView.title}</div>
            <div className="read-notes-body" style={{ padding: '0 14px 16px' }}>{noteView.note}</div>
          </div>
        </div>
      )}

      {/* 段评面板 */}
      {annOpen && (
        <div className="read-ann glass3" onClick={(e) => e.stopPropagation()}>
          <div className="read-ann-quote">「{(cur.paras[annOpen.para] || '').slice(0, 50)}…」</div>
          <div className="read-ann-list">
            {annsOf(annOpen.para).map((a) => (
              <div key={a.id} className="read-thread">
                <div className={`read-note ${a.who}`}>
                  <span className="read-note-who">{a.who === 'ayan' ? '晏白' : '婉莹'}</span>
                  {a.note}
                </div>
                {(a.replies || []).map((r, j) => (
                  <div key={j} className={`read-note reply ${r.who}`}>
                    <span className="read-note-who">{r.who === 'ayan' ? '晏白' : '婉莹'}</span>
                    {r.text}
                  </div>
                ))}
                <button className="read-reply-btn" onClick={() => {
                  const t = prompt('接着这张纸条说:')
                  if (t && t.trim()) sendAnn(annOpen.para, a.id, t.trim())
                }}>↩ 回这张纸条</button>
              </div>
            ))}
          </div>
          <div className="read-ann-write">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="在这段旁边写点什么…"
              rows={2}
            />
            <button onClick={() => sendAnn(annOpen.para)}>🖊</button>
          </div>
        </div>
      )}
      {toast && <div className="chat-toast">{toast}</div>}
    </div>
  )
}
