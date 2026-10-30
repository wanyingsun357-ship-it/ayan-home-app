import { useEffect, useRef, useState } from 'react'
import { NAMES } from '../config.js'
import PaperAvatar from '../components/PaperAvatar.jsx'
import MomentsBackgroundPicker, { readMomentsBackground } from '../components/MomentsBackgroundPicker.jsx'
import { compressImage, postUpload } from '../utils/compressImage.js'
import './moments.css'
import { useAppearance } from '../utils/appearance.js'

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

export const MomentIcon = ({ kind }) => <svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{({
 camera:<><rect x="3" y="7" width="22" height="17" rx="3"/><path d="m8 7 2-4h8l2 4"/><circle cx="14" cy="15" r="5"/></>,
 talk:<><path d="M20 16a8 8 0 0 1-11 7l-5 2 1-5a8 8 0 1 1 15-4Z"/><path d="M11 6a7 7 0 0 1 13 6l1 5-5-1"/></>,
 back:<path d="m17 5-9 9 9 9"/>, plus:<path d="M14 5v18M5 14h18"/>,
 heart:<path d="M14 24 4.5 15C-3 7 8 0 14 8c6-8 17-1 9.5 7Z"/>,
 comments:<path d="M24 13a10 10 0 0 1-14 9l-6 2 2-6a10 10 0 1 1 18-5Z"/>,
 people:<><circle cx="11" cy="8" r="4"/><path d="M3 25v-5c0-6 16-6 16 0v5M20 4c6 0 6 8 1 8m1 4c5 1 4 5 4 8"/></>,
 smile:<><circle cx="14" cy="14" r="10"/><path d="M9 16c2 5 8 5 10 0"/><circle cx="10" cy="11" r=".8"/><circle cx="18" cy="11" r=".8"/></>,
 sun:<><circle cx="14" cy="14" r="4"/><path d="M14 1v4m0 18v4M1 14h4m18 0h4M5 5l3 3m12 12 3 3M5 23l3-3M20 8l3-3"/></>,
 switch:<path d="m9 10 5-5 5 5M9 18l5 5 5-5"/>
 })[kind]}</svg>

export default function Moments({ back, go }) {
  const lavender = useAppearance().theme === 'orange'
  const displayName = author => lavender && author === 'wanying' ? '𝒱ℯ𝓇𝒶' : NAME[author]
  const momentTime = iso => { const d = new Date(iso); return lavender ? `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : fmtWhen(iso) }
  const [background, setBackground] = useState(readMomentsBackground)
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
        images.push((await postUpload(c.name, c.base64)).url)
      }
      const response = await fetch('/api/moments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim(), images }),
      })
      if (!response.ok) throw new Error('publish failed')
      setText(''); setImg(null); setComposeOpen(false)
      await load()
    } catch { showToast('没发出去,再试一次') }
    setPosting(false)
  }

  const toggleLike = async (m) => {
    setMoments((ms) => ms.map((x) => x.id === m.id ? { ...x, liked_by_wanying: !x.liked_by_wanying } : x))
    try { const r = await fetch(`/api/moments/${m.id}/like`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked: !m.liked_by_wanying }),
    }); if (!r.ok) throw new Error('like failed')
    } catch { await load(); showToast('点赞没保存，请再试一次') }
  }

  const sendComment = async (m) => {
    const c = commentText.trim()
    if (!c) return
    try {
    const response = await fetch(`/api/moments/${m.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c }),
    })
    if (!response.ok) throw new Error('comment failed')
    setCommentText(''); setCommentFor(null)
    await load()
    showToast('他过一会儿会看到的 🫧')
    } catch { showToast('评论没发出，文字已保留') }
  }

  const del = async (m) => {
    if (!confirm('删掉这条动态?')) return
    try { const r = await fetch(`/api/moments/${m.id}`, { method: 'DELETE' }); if (!r.ok) throw new Error('delete failed'); await load() }
    catch { showToast('没有删掉，请再试一次') }
  }

  const likedLine = (m) => {
    const who = []
    if (m.liked_by_ayan) who.push(displayName('ayan'))
    if (m.liked_by_wanying) who.push(displayName('wanying'))
    return who.length ? `liked by ${who.join(' & ')}` : null
  }

  return (
    <div className={`mo ${lavender ? 'lavender-moments' : ''}`}>
      {lavender ? <header className="vera-head"><div><h1>Moments</h1><p>Yanbai only</p></div><nav><button aria-label="返回主页" onClick={back}><MomentIcon kind="back" /></button><button aria-label="发布动态" onClick={() => setComposeOpen(true)}><MomentIcon kind="plus" /></button></nav></header> : <header className="mo-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div className="serif mo-title">Moments</div>
        <button className="stub-back mo-newbtn" onClick={() => setComposeOpen(true)}>＋</button>
      </header>}

      <div className={`mo-feed ${lavender && background ? 'has-custom-background' : ''}`} style={lavender && background ? {'--mo-custom-background': `url("${background}")`} : undefined}>
        {lavender && <section className="vera-profile" aria-label="𝒱ℯ𝓇𝒶 的主页"><PaperAvatar who="her" editable /><h2 aria-label="Vera">𝒱ℯ𝓇𝒶</h2></section>}
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
              <PaperAvatar who={m.author === 'wanying' ? (lavender ? 'her' : 'me') : 'him'} />
              <div className="mo-byline">
                <span className="serif mo-author">{displayName(m.author)}</span>
                <span className="serif mo-when">{momentTime(m.created_at)}</span>
              </div>
              <button className="mo-del" onClick={() => del(m)}>{lavender ? '删除' : 'delete'}</button>
            </div>
            {m.content && <div className="mo-content">{m.content}</div>}
            {m.images?.map((u, i) => (
              <img key={i} className="mo-img" src={u} alt="" />
            ))}
            <div className="mo-actions">
              <button
                className={`mo-like ${m.liked_by_wanying ? 'on' : ''}`}
                onClick={() => toggleLike(m)} aria-label={m.liked_by_wanying ? '取消点赞' : '点赞'} aria-pressed={Boolean(m.liked_by_wanying)} title={likedLine(m) || undefined}
              >{lavender ? <><MomentIcon kind="heart" /><span>{Number(Boolean(m.liked_by_wanying))+Number(Boolean(m.liked_by_ayan))}</span></> : '♡'}</button>
              <button className="mo-cbtn" aria-label="评论" onClick={() => { setCommentFor(commentFor === m.id ? null : m.id); setCommentText('') }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M20 11a8 8 0 0 1-11 7l-5 2 1-5a8 8 0 1 1 15-4Z"/></svg>{lavender && <span>{m.comments?.length || 0}</span>}
              </button>
              {likedLine(m) && <span className="mo-liked serif">♡ {likedLine(m)}</span>}
            </div>
            <div className={lavender ? 'vera-discussion' : undefined}>
            {m.comments?.length > 0 && (
              <div className="mo-comments">
                {m.comments.map((c) => (
                  <div key={c.id} className={`mo-comment ${c.author}`}>
                    {lavender ? <div className="vera-comment-meta"><span className="mo-cname">{displayName(c.author)}</span><time className="mo-ctime">{momentTime(c.created_at)}</time></div> : <span className="serif mo-cname">{NAME[c.author]}</span>}
                    <div className="mo-ctext">{c.content}</div>
                    {!lavender && <div className="mo-ctime">{fmtWhen(c.created_at)}</div>}
                  </div>
                ))}
              </div>
            )}
            {commentFor === m.id && (
              <div className="mo-cinput">
                <input
                  autoFocus={!lavender}
                  aria-label="写评论"
                  onFocus={() => { if (lavender && commentFor !== m.id) { setCommentFor(m.id); setCommentText('') } }}
                  value={lavender && commentFor !== m.id ? '' : commentText}
                  onChange={(e) => {setCommentFor(m.id);setCommentText(e.target.value)}}
                  placeholder={lavender ? '写评论…' : '说点什么…'}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendComment(m) }}
                />
                <button aria-label="发送评论" disabled={lavender && (commentFor !== m.id || !commentText.trim())} onClick={() => sendComment(m)}>{lavender ? '发送' : '↑'}</button>
              </div>
            )}
            </div>
          </article>
        ))}
      </div>

      {lavender && <div className="vera-bottom"><nav className="vera-dock" aria-label="页面导航"><div className="vera-dock-main">{[['talk','diary','Diary'],['people','moments','Moments'],['smile','chat','Chat'],['sun','home','Home']].map(([kind,page,label])=><button key={page} type="button" className={page==='moments'?'selected':''} aria-label={label} aria-current={page==='moments'?'page':undefined} onClick={()=>{if(page!=='moments')go(page)}}><MomentIcon kind={kind}/></button>)}</div><button className="vera-dock-plus" aria-label="More" onClick={()=>go('more')}><MomentIcon kind="plus"/></button></nav></div>}

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
              <button className="mo-cam" aria-label="给动态添加图片" onClick={() => fileRef.current?.click()}><MomentIcon kind="camera"/></button>
              {lavender && <MomentsBackgroundPicker value={background} onChange={setBackground} />}
              <div style={{ flex: 1 }} />
              <button
                className="mo-publish"
                onClick={post}
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
