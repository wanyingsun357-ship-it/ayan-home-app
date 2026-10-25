import artwork from './components/homeArtwork.json'
import { useEffect, useState } from 'react'
import Splash from './components/Splash.jsx'
import Sidebar from './components/Sidebar.jsx'
import Home from './pages/Home.jsx'
import WarmHome from './pages/WarmHome.jsx'
import WarmSplash from './components/WarmSplash.jsx'
import {useAppearance,applyAppearance} from './utils/appearance.js'
import Chat from './pages/Chat.jsx'
import Moments from './pages/Moments.jsx'
import Diary from './pages/Diary.jsx'
import Memory from './pages/Memory.jsx'
import Mind from './pages/Mind.jsx'
import Read from './pages/Read.jsx'
import Stub from './pages/Stub.jsx'
import Settings from './pages/Settings.jsx'
import Together from './pages/Together.jsx'
import Footprints from './pages/Footprints.jsx'
import Gallery from './pages/Gallery.jsx'
import CommandWidget from './components/CommandWidget.jsx'
import CallOverlay from './components/CallOverlay.jsx'
import EngineAccess from './components/EngineAccess.jsx'
import { installEngineAccess } from './utils/engineAccess.js'
import { setupPush, isApp, Keyboard, syncStatusBar, geo, reportBattery } from './utils/native.js'

const PAGES = {
}
installEngineAccess()

const TABS = [
  { key: 'home', icon: '⌂', label: 'Home' },
  { key: 'moments', icon: '✧', label: 'Moments' },
  { key: 'chat', icon: '☾', label: 'Chat' },
  { key: 'diary', icon: '✎', label: 'Diary' },
  { key: 'more', icon: '⋯', label: 'More' },
]

const MORE_ITEMS = [
  { key: 'footprints', label: 'Footprints', sub: '他醒来后，留下的小小踪迹' },
  { key: 'together', label: 'Together', sub: 'life, kept · 三餐/睡眠/记账' },
  { key: 'gallery', label: 'Gallery', sub: '相册 · 他留下的' },
  { key: 'read', label: 'Read', sub: '一起看书' },
  { key: 'mind', label: 'Mind', sub: '他的感受' },
  { key: 'memory', label: 'Memory', sub: '记忆库' },
  { key: 'settings', label: 'Settings', sub: 'make it yours' },
]

export default function App() {
  const appearance=useAppearance()
  const warm=appearance.theme==='orange'
  const [splashDone, setSplashDone] = useState(false)
  const [splashReveal, setSplashReveal] = useState(false)
  useEffect(()=>{const done=()=>setSplashDone(true);window.addEventListener('call:visible',done);return()=>window.removeEventListener('call:visible',done)},[])
  const [view, setView] = useState('home')
  useEffect(()=>{applyAppearance(view)},[view,appearance])
  useEffect(() => {
    document.documentElement.dataset.paperSurface = ['home','together','settings'].includes(view) ? 'home' : 'chat'
    document.documentElement.dataset.paperBackgroundOnly = String(['moments','diary','together','footprints','memory'].includes(view))
  }, [view])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [diaryDot, setDiaryDot] = useState(false)
  const [banner, setBanner] = useState(null)

  const go = (v) => {
    setSplashDone(true)
    if (v === 'more') { setMoreOpen(true); return }
    if (v === 'diary') {
      // 进日记本=已读
      localStorage.setItem('diary-ev-seen', new Date().toISOString())
      setDiaryDot(false)
    }
    setView(v)
    setSidebarOpen(false)
    setMoreOpen(false)
  }

  // 日记本的新动静:红点 + 微信式顶部横幅
  useEffect(() => {
    let stopped = false
    const check = async () => {
      try {
        const r = await fetch('/api/diary')
        const d = await r.json()
        const seen = localStorage.getItem('diary-ev-seen') || '1970-01-01'
        const unseen = (d.events || []).filter((e) => e.at > seen)
        if (stopped || !unseen.length) return
        setDiaryDot(true)
        const bannered = localStorage.getItem('diary-ev-bannered') || '1970-01-01'
        const fresh = unseen.filter((e) => e.at > bannered)
        if (fresh.length && !isApp()) {
          setBanner(fresh[0].text + (fresh.length > 1 ? ` 等${fresh.length}条` : ''))
          localStorage.setItem('diary-ev-bannered', unseen[0].at)
          setTimeout(() => setBanner(null), 5000)
        }
      } catch {}
    }
    check()
    const t = setInterval(check, 90 * 1000)
    return () => { stopped = true; clearInterval(t) }
  }, [])

  // 整页高度的页面(聊天)不让文档本身滚动:iOS 网页容器会在聚焦输入框/弹层时把整页往上带
  useEffect(() => {
    document.documentElement.classList.toggle('no-scroll', view === 'chat')
    if (view === 'chat') window.scrollTo(0, 0)
  }, [view])

  // 定位:App 打开和回前台各上报一次;有"始终"权限就顺便挂上后台显著变化监听
  useEffect(() => {
    if (!isApp()) return
    const tick = async () => {
      reportBattery()
      if (localStorage.getItem('loc-on') === '0') return
      const st = await geo.status()
      if (st.auth === 'prompt') return // 还没在 Settings 里授权
      if (st.auth === 'always' || st.auth === 'whenInUse') { geo.report(); if (st.auth === 'always') geo.startBackground() }
    }
    tick()
    const onVis = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 状态栏颜色跟日夜主题(主题切换时 data-theme 会变)
  useEffect(() => {
    syncStatusBar()
    const mo = new MutationObserver(syncStatusBar)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])

  // App 里注册推送:日记事件用原生通知;其余推送仍按原有入口处理
  useEffect(() => {
    setupPush({
      onOpen: (d) => { const k = (d && d.kind) || ''; go(k === 'test' ? 'home' : k === 'diary' ? 'diary' : 'chat') },
      onReceive: (d) => {
        if ((d && d.kind) !== 'diary') return
        setDiaryDot(true)
      },
    })
  }, [])

  // App 里键盘由我们自己让位:原生插件在键盘动画开始那一刻就报高度,写进 --kb,页面立刻缩,不等系统慢半拍
  useEffect(() => {
    if (!isApp()) return
    const K = Keyboard
    const setKb = (h) => { document.documentElement.style.setProperty('--kb', h + 'px'); window.dispatchEvent(new CustomEvent('kb', { detail: h })) }
    const hs = [K.addListener('keyboardWillShow', (e) => setKb(e.keyboardHeight || 0)), K.addListener('keyboardWillHide', () => setKb(0))]
    return () => { hs.forEach((p) => p.then?.((h) => h.remove())) }
  }, [])

  // 记住整屏高度(只增不减):键盘弹起时 App 容器会变矮,背景图不能跟着缩
  useEffect(() => {
    let maxH = 0
    const set = () => { const h = window.innerHeight; if (h > maxH) { maxH = h; document.documentElement.style.setProperty('--full-h', h + 'px') } }
    set(); window.addEventListener('resize', set); window.addEventListener('orientationchange', () => { maxH = 0; setTimeout(set, 300) })
    return () => window.removeEventListener('resize', set)
  }, [])

  const showTabs = ['home', 'moments', 'diary'].includes(view)

  return (
    <>
      <div className="wetglass-bg" />

      <div className={`intro-content intro-joined ${!splashDone ? (splashReveal ? 'revealing' : 'preparing') : ''}`} inert={!splashDone ? '' : undefined}>
      {/* 微信式顶部横幅 */}
      {banner && (
        <button className="top-banner glass3" onClick={() => { setBanner(null); go('diary') }}>
          <span className="top-banner-moon">☾</span>
          <span className="top-banner-text">{banner}</span>
        </button>
      )}

      {view === 'home' && (warm ? <WarmHome diaryDot={diaryDot} go={go} openSidebar={() => setSidebarOpen(true)} /> : <Home go={go} openSidebar={() => setSidebarOpen(true)} />)}
      {view === 'chat' && <Chat back={() => go('home')} />}
      {view === 'moments' && <Moments back={() => go('home')} />}
      {view === 'diary' && <Diary back={() => go('home')} />}
      {view === 'memory' && <Memory back={() => go('home')} goSettings={() => go('settings')} />}
      {view === 'mind' && <Mind back={() => go('home')} />}
      {view === 'read' && <Read back={() => go('home')} />}
      {view === 'settings' && <Settings back={() => go('home')} />}
      {view === 'together' && <Together back={() => go('home')} />}
      {view === 'footprints' && <Footprints back={() => go('home')} />}
      {view === 'gallery' && <Gallery back={() => go('home')} go={go} />}
      {PAGES[view] && <Stub page={PAGES[view]} back={() => go('home')} />}

      {/* 底部 Tab */}
      {showTabs && !(warm && view==='home') && (
        <nav className={`tabbar glass3 ${warm ? 'warm-page-dock' : ''}`} aria-label="页面导航">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-item ${view === t.key ? 'active' : ''}`}
              onClick={() => go(t.key)}
            >
              <span className="tab-icon">
                {warm ? <span className="warm-tab-art" dangerouslySetInnerHTML={{__html:artwork.icons[t.key] || (t.key==='home' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/></svg>')}}/> : t.icon}
                {t.key === 'diary' && diaryDot && <i className="tab-dot" />}
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* More 弹层 */}
      {moreOpen && (
        <div className={`sheet-mask ${warm?"warm-more-mask":""}`} onClick={() => setMoreOpen(false)}>
          <div className="sheet glass3-sheet" onClick={(e) => e.stopPropagation()}>
            {warm?<><button className="detail-close" aria-label="关闭 More" onClick={()=>setMoreOpen(false)}>×</button><h2 className="warm-more-title">More</h2></>:<div className="sheet-handle" />}
            {MORE_ITEMS.map((it) => (
              <button key={it.key} className="sheet-item more-item" onClick={() => go(it.key)}>
                <span className="serif">{it.label}</span>
                <span className="more-sub">{it.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {splashDone && <CommandWidget />}
      <EngineAccess />
      <CallOverlay />
      <Sidebar
        open={sidebarOpen}
        close={() => setSidebarOpen(false)}
        go={go}
        current={view}
      />
      </div>
      {!splashDone && (warm ? <WarmSplash onReveal={() => setSplashReveal(true)} onDone={() => setSplashDone(true)} /> : <Splash onReveal={() => setSplashReveal(true)} onDone={() => setSplashDone(true)} />)}
    </>
  )
}
