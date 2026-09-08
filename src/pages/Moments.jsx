import { useEffect, useRef, useState } from 'react'
import { NAMES } from '../config.js'
import { compressImage, postUpload } from '../utils/compressImage.js'
import './moments.css'

// Moments:我们各自路过同一面墙,留下痕迹
const NAME = { ayan: NAMES.me, wanying: NAMES.her }

function fmtWhen(iso) {
  const d = new Date(iso)
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return `Today · ${hm}`
  const yest = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yest.toDateString()) return `Yesterday · ${hm}`
  return `${d.getMonth() + 1}.${d.getDate()} · ${hm}`
}

export default function Moments({ back }) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [img, setImg] = useState(null)        // {file, preview}
  const [posting, setPosting] = useState(false)
  const [commentFor, setCommentFor] = useState(null)  // moment id
  const [commentText, setCommentText] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2200) }

  const load = async () => {
    try {
      const r = await fetch('/api/moments')
      const d = await r.json()
      setMoments(d.moments || [])
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const pickImg = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 30 * 1024 * 1024) { showToast('太大了,上限30MB'); return }
    setImg({ file: f, preview: URL.createObjectURL(f) })
  }

  const post = async () => {
    if ((!text.trim() && !img) || posting) return
    setPosting(true)
    try {
      const images = []
      if (img) {
        // 先压缩(自适应到350KB以下)再上传,失败自动重试3次
        const c = await compressImage(img.file)
        try { images.push((await postUpload(c.name, c.base64)).url) } catch {}
      }
      await fetch('/api/moments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim(), images }),
      })
      setText(''); setImg(null)
      await load()
    } catch { showToast('没发出去,再试一次') }
    setPosting(false)
  }

  const toggleLike = async (m) => {
    setMoments((ms) => ms.map((x) => x.id === m.id ? { ...x, liked_by_wanying: !x.liked_by_wanying } : x))
    await fetch(`/api/moments/${m.id}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked: !m.liked_by_wanying }),
    }).catch(() => {})
  }

  const sendComment = async (m) => {
    const c = commentText.trim()
    if (!c) return
    setCommentText(''); setCommentFor(null)
    await fetch(`/api/moments/${m.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c }),
    }).catch(() => {})
    await load()
    showToast('他过一会儿会看到的 🫧')
  }

  const del = async (m) => {
    if (!confirm('删掉这条动态?')) return
    await fetch(`/api/moments/${m.id}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  const likedLine = (m) => {
    const who = []
    if (m.liked_by_ayan) who.push(NAME.ayan)
    if (m.liked_by_wanying) who.push(NAME.wanying)
    return who.length ? `liked by ${who.join(' & ')}` : null
  }

  return (
    <div className="mo">
      <header className="mo-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div className="serif mo-title">Moments</div>
        <button className="stub-back mo-newbtn" onClick={() => setComposeOpen(true)}>＋</button>
      </header>

      <div className="mo-feed">
        {loading && <div className="mo-empty serif">walking by…</div>}
        {!loading && moments.length === 0 && (
          <div className="mo-empty serif">
            still a blank wall.<br />
            <span className="mo-empty-sub">留下第一条痕迹吧</span>
          </div>
        )}
        {moments.map((m) => (
          <article key={m.id} className="mo-post">
            <div className="mo-meta">
              <span className="serif mo-when">{fmtWhen(m.created_at)}</span>
              <span className="serif mo-author">{NAME[m.author]}</span>
              <button className="mo-del" onClick={() => del(m)}>delete</button>
            </div>
            {m.content && <div className="mo-content">{m.content}</div>}
            {m.images?.map((u, i) => (
              <img key={i} className="mo-img" src={u} alt="" />
            ))}
            <div className="mo-actions">
              <button
                className={`mo-like ${m.liked_by_wanying ? 'on' : ''}`}
                onClick={() => toggleLike(m)}
              >♡</button>
              <button className="mo-cbtn" onClick={() => { setCommentFor(commentFor === m.id ? null : m.id); setCommentText('') }}>
                评论
              </button>
              {likedLine(m) && <span className="mo-liked serif">♡ {likedLine(m)}</span>}
            </div>
            {m.comments?.length > 0 && (
              <div className="mo-comments">
                {m.comments.map((c) => (
                  <div key={c.id} className={`mo-comment ${c.author}`}>
                    <span className="serif mo-cname">{NAME[c.author]}</span>
                    <div className="mo-ctext">{c.content}</div>
                    <div className="mo-ctime">{fmtWhen(c.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
            {commentFor === m.id && (
              <div className="mo-cinput">
                <input
                  autoFocus
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="说点什么…"
                  onKeyDown={(e) => { if (e.key === 'Enter') sendComment(m) }}
                />
                <button onClick={() => sendComment(m)}>↑</button>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* 发布弹层(右上角＋打开) */}
      {composeOpen && (
        <div className="sheet-mask" onClick={() => setComposeOpen(false)}>
          <div className="sheet mo-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="serif mo-sheet-title">share a little thing…</div>
            <textarea
              autoFocus
              className="mo-sheet-ta"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="此刻…"
            />
            {img && (
              <div className="mo-preview">
                <img src={img.preview} alt="" />
                <button onClick={() => setImg(null)}>×</button>
              </div>
            )}
            <div className="mo-sheet-bar">
              <button className="mo-cam" onClick={() => fileRef.current?.click()}>📷</button>
              <div style={{ flex: 1 }} />
              <button
                className="mo-publish"
                onClick={async () => { await post(); setComposeOpen(false) }}
                disabled={posting || (!text.trim() && !img)}
              >{posting ? '…' : '发布'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="chat-toast">{toast}</div>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImg} />
    </div>
  )
}
