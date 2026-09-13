import { useEffect, useRef, useState } from 'react'
import { NAMES } from '../config.js'
import './gallery.css'

// Gallery · 相册:每个家一本。他存的、她放的、他画的印记;每张有他第一次看见时留下的两段字
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
const fileToBase64 = (f) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result).split(',')[1])
  r.onerror = rej
  r.readAsDataURL(f)
})

export default function Gallery({ back, go }) {
  const [homes, setHomes] = useState([])
  const [sid, setSid] = useState('')
  const [data, setData] = useState(null)
  const [album, setAlbum] = useState(null)   // 打开的相簿名
  const [cur, setCur] = useState(null)       // 打开的照片
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [newAlbum, setNewAlbum] = useState(false)
  const [newName, setNewName] = useState('')
  const fileRef = useRef(null)

  const say = (t) => { setToast(t); setTimeout(() => setToast(''), 2200) }
  const load = async (id = sid) => {
    if (!id) return
    try { const r = await fetch(`/api/gallery?session=${id}`); setData(await r.json()) } catch {}
  }
  useEffect(() => {
    (async () => {
      try {
        const d = await (await fetch('/api/sessions')).json()
        const hs = d.sessions || []
        setHomes(hs)
        const first = d.activeId || hs[0]?.id || ''
        setSid(first)
      } catch {}
    })()
  }, [])
  useEffect(() => { if (sid) { setAlbum(null); setCur(null); setData(null); load(sid) } }, [sid])
  // 打开照片时描述可能还在路上:几秒后再拉一次
  useEffect(() => {
    if (!cur || cur.description) return
    const t = setTimeout(() => load(), 4000)
    return () => clearTimeout(t)
  }, [cur])
  useEffect(() => { if (cur && data) { const n = data.items.find((x) => x.id === cur.id); if (n) setCur(n) } }, [data])

  const items = data ? data.items.filter((x) => !album || x.album === album) : []
  const albums = data ? data.albums : []
  const homeTitle = homes.find((h) => h.id === sid)?.title || ''

  // ---- 动作 ----
  const upload = async (files) => {
    if (!files?.length || !sid) return
    setBusy(true)
    let n = 0, dup = 0
    for (const f of files) {
      try {
        const data64 = await fileToBase64(f)
        const r = await fetch('/api/gallery/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: sid, album: album || '未分类', name: f.name, data: data64 }) })
        const j = await r.json()
        if (j.ok) { if (j.duplicate) dup++; else n++ }
      } catch {}
    }
    setBusy(false)
    say(n ? `放进去了 ${n} 张${dup ? `,${dup} 张已经有了` : ''}` : dup ? '这些已经在相册里了' : '没放进去')
    load()
  }
  const createAlbum = async () => {
    const name = newName.trim()
    if (!name) return
    await fetch('/api/gallery/album', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: sid, name }) }).catch(() => {})
    setNewName(''); setNewAlbum(false); load()
  }
  const renameAlbum = async () => {
    const name = window.prompt('相簿改名', album)
    if (!name || name.trim() === album) return
    await fetch('/api/gallery/album', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: sid, rename: album, name: name.trim() }) }).catch(() => {})
    setAlbum(name.trim()); load()
  }
  const deleteAlbum = async () => {
    if (!window.confirm(`删掉相簿「${album}」?里面的照片会挪到「未分类」,不会删照片`)) return
    await fetch(`/api/gallery/album/${encodeURIComponent(album)}?session=${sid}`, { method: 'DELETE' }).catch(() => {})
    setAlbum(null); load()
  }
  const patch = async (p) => {
    if (!cur) return
    try { const r = await fetch(`/api/gallery/${cur.id}?session=${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }); const j = await r.json(); if (j.item) setCur(j.item) } catch {}
    load()
  }
  const retitle = () => { const t = window.prompt('标题', cur.title || ''); if (t !== null) patch({ title: t }) }
  const remove = async () => {
    if (!window.confirm('从相册里删掉这张?')) return
    await fetch(`/api/gallery/${cur.id}?session=${sid}`, { method: 'DELETE' }).catch(() => {})
    setCur(null); load()
  }
  const bringToChat = async () => {
    if (!cur) return
    setBusy(true)
    try {
      const name = cur.url.split('/').pop()
      const r = await fetch('/api/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: sid,
          message: `(从相册带来一张:《${cur.album}》${cur.title ? ' · ' + cur.title : ''}${cur.impression ? ` · 你当时说:${cur.impression}` : ''})`,
          attachments: [{ name, url: cur.url, path: '/root/ayan/bridge/public' + cur.url, type: /png$/i.test(name) ? 'image/png' : 'image/jpeg' }],
        }),
      })
      if (r.status === 429) { say('他正在说话,等一下再带'); setBusy(false); return }
      setBusy(false)
      go && go('chat')
    } catch { setBusy(false); say('没带过去') }
  }

  return (
    <div className="page gl">
      <div className="gl-head">
        <button className="stub-back" onClick={() => (cur ? setCur(null) : album ? setAlbum(null) : back())}>‹</button>
        <div className="gl-title serif">{album ? album : 'Gallery'}</div>
        <div className="gl-head-r">
          {album && !cur && <button className="gl-ico" onClick={renameAlbum} title="改名">✎</button>}
          {album && !cur && <button className="gl-ico" onClick={deleteAlbum} title="删相簿">×</button>}
          {!album && !cur && <button className="gl-ico" onClick={() => setNewAlbum(true)} title="新相簿">+</button>}
        </div>
      </div>

      {/* 哪个家的相册 */}
      {!cur && (
        <div className="gl-homes">
          {homes.map((h) => (
            <button key={h.id} className={`gl-home ${h.id === sid ? 'on' : ''}`} onClick={() => setSid(h.id)}>{h.title}</button>
          ))}
        </div>
      )}

      {/* 相簿列表 */}
      {!album && !cur && (
        <div className="gl-albums">
          {!data && <div className="gl-empty">翻开中…</div>}
          {data && !albums.length && (
            <div className="gl-empty">这个家的相册还是空的<br /><small>他看过的照片想留住会自己存进来;你也可以先建一本</small></div>
          )}
          {albums.map((a) => (
            <button key={a.name} className="gl-album glass2" onClick={() => setAlbum(a.name)}>
              <div className="gl-album-cover">{a.cover ? <img src={a.cover} alt="" /> : <span>◌</span>}</div>
              <div className="gl-album-name serif">{a.name}</div>
              <div className="gl-album-n">{a.n} 张</div>
            </button>
          ))}
          {newAlbum && (
            <div className="gl-album gl-album-new glass2">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="相簿名" maxLength={12} onKeyDown={(e) => { if (e.key === 'Enter') createAlbum(); if (e.key === 'Escape') setNewAlbum(false) }} />
              <div className="gl-album-new-btns"><button onClick={createAlbum}>建</button><button onClick={() => { setNewAlbum(false); setNewName('') }}>算了</button></div>
            </div>
          )}
        </div>
      )}

      {/* 一本相簿:瀑布流 */}
      {album && !cur && (
        <>
          <div className="gl-wall">
            {items.map((it) => (
              <button key={it.id} className="gl-cell" onClick={() => { setCur(it); setDescOpen(false); setMoveOpen(false) }}>
                <img src={it.url} alt={it.title} loading="lazy" />
                {(it.title || it.by === 'her') && <div className="gl-cell-cap">{it.by === 'her' && <i>你放的 </i>}{it.title}</div>}
              </button>
            ))}
            {!items.length && <div className="gl-empty">还没有照片</div>}
          </div>
          <button className="gl-fab glass3" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? '…' : '+'}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />
        </>
      )}

      {/* 一张照片 */}
      {cur && (
        <div className="gl-view">
          <div className="gl-view-img"><img src={cur.url} alt={cur.title} /></div>
          <div className="gl-view-paper glass2">
            <div className="gl-view-top">
              <div className="gl-view-title serif">{cur.title || '(无题)'}</div>
              <div className="gl-view-meta">《{cur.album}》 · {cur.by === 'her' ? '你放的' : `${NAMES.me} 存的`} · {fmtDate(cur.createdAt)}{cur.sentCount ? ` · 他发给你过 ${cur.sentCount} 次` : ''}</div>
            </div>
            {cur.impression ? (
              <div className="gl-imp"><small>当时留下的第一印象</small><p className="serif">{cur.impression}</p></div>
            ) : (
              <div className="gl-imp dim"><small>他还没给这张写第一印象</small></div>
            )}
            {cur.source?.text && <div className="gl-src">来自聊天 · {fmtDate(cur.source.at)} · 「{cur.source.text}」</div>}
            <button className="gl-desc-btn" onClick={() => setDescOpen((v) => !v)}>{descOpen ? '收起' : '他第一次看见的'}</button>
            {descOpen && <div className="gl-desc">{cur.description || '画面描述还在路上…'}</div>}
            <div className="gl-actions">
              <button onClick={bringToChat} disabled={busy}>带去 Chat</button>
              <button onClick={retitle}>改标题</button>
              <button onClick={() => setMoveOpen((v) => !v)}>移到相簿</button>
              <button className="danger" onClick={remove}>删除</button>
            </div>
            {moveOpen && (
              <div className="gl-move">
                {albums.filter((a) => a.name !== cur.album).map((a) => <button key={a.name} onClick={() => { patch({ album: a.name }); setMoveOpen(false) }}>{a.name}</button>)}
                <button onClick={() => { const n = window.prompt('新相簿名'); if (n && n.trim()) { patch({ album: n.trim() }); setMoveOpen(false) } }}>+ 新相簿</button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="gl-toast glass3">{toast}</div>}
      {!cur && !album && data && <div className="gl-foot">{homeTitle} · {data.items.length} 张</div>}
    </div>
  )
}
