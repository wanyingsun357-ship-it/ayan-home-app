import { useEffect, useState } from 'react'
import Splash from './components/Splash.jsx'
import Sidebar from './components/Sidebar.jsx'
import Home from './pages/Home.jsx'
import Chat from './pages/Chat.jsx'
import Moments from './pages/Moments.jsx'
import Diary from './pages/Diary.jsx'
import Memory from './pages/Memory.jsx'
import Mind from './pages/Mind.jsx'
import Read from './pages/Read.jsx'
import Stub from './pages/Stub.jsx'
import Settings from './pages/Settings.jsx'
import Together from './pages/Together.jsx'
import CommandWidget from './components/CommandWidget.jsx'
import CallOverlay from './components/CallOverlay.jsx'

const PAGES = {
}

const TABS = [
  { key: 'home', icon: '⌂', label: 'Home' },
  { key: 'moments', icon: '✧', label: 'Moments' },
  { key: 'chat', icon: '☾', label: 'Chat' },
  { key: 'diary', icon: '✎', label: 'Diary' },
  { key: 'more', icon: '⋯', label: 'More' },
]

const MORE_ITEMS = [
  { key: 'together', label: 'Together', sub: 'life, kept · 三餐/睡眠/记账' },
  { key: 'read', label: 'Read', sub: '一起看书' },
  { key: 'mind', label: 'Mind', sub: '他的感受' },
  { key: 'memory', label: 'Memory', sub: '记忆库' },
  { key: 'settings', label: 'Settings', sub: 'make it yours' },
]

export default function App() {
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('splashed') === '1'
  )
  const [view, setView] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [diaryDot, setDiaryDot] = useState(false)
  const [banner, setBanner] = useState(null)

  const go = (v) => {
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
        if (fresh.length) {
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

  useEffect(() => {
    if (splashDone) sessionStorage.setItem('splashed', '1')
  }, [splashDone])

  // 整页高度的页面(聊天)不让文档本身滚动:iOS 网页容器会在聚焦输入框/弹层时把整页往上带
  useEffect(() => {
    document.documentElement.classList.toggle('no-scroll', view === 'chat')
    if (view === 'chat') window.scrollTo(0, 0)
  }, [view])

  // 记住整屏高度(只增不减):键盘弹起时 App 容器会变矮,背景图不能跟着缩
  useEffect(() => {
    let maxH = 0
    const set = () => { const h = window.innerHeight; if (h > maxH) { maxH = h; document.documentElement.style.setProperty('--full-h', h + 'px') } }
    set(); window.addEventListener('resize', set); window.addEventListener('orientationchange', () => { maxH = 0; setTimeout(set, 300) })
    return () => window.removeEventListener('resize', set)
  }, [])

  // 用户外观偏好:背景强度/玻璃透明度
  useEffect(() => {
    const dim = localStorage.getItem('bg-dim')
    const gk = localStorage.getItem('glass-k')
    if (dim) document.documentElement.style.setProperty('--bg-dim', dim)
    if (gk) document.documentElement.style.setProperty('--gk', gk)
  }, [])

  if (!splashDone) {
    return (
      <>
        <div className="wetglass-bg" />
        <Splash onDone={() => setSplashDone(true)} />
      </>
    )
  }

  const showTabs = ['home', 'moments', 'diary'].includes(view)

  return (
    <>
      <div className="wetglass-bg" />

      {/* 微信式顶部横幅 */}
      {banner && (
        <button className="top-banner glass3" onClick={() => { setBanner(null); go('diary') }}>
          <span className="top-banner-moon">☾</span>
          <span className="top-banner-text">{banner}</span>
        </button>
      )}

      {view === 'home' && <Home go={go} openSidebar={() => setSidebarOpen(true)} />}
      {view === 'chat' && <Chat back={() => go('home')} />}
      {view === 'moments' && <Moments back={() => go('home')} />}
      {view === 'diary' && <Diary back={() => go('home')} />}
      {view === 'memory' && <Memory back={() => go('home')} goSettings={() => go('settings')} />}
      {view === 'mind' && <Mind back={() => go('home')} />}
      {view === 'read' && <Read back={() => go('home')} />}
      {view === 'settings' && <Settings back={() => go('home')} />}
      {view === 'together' && <Together back={() => go('home')} />}
      {PAGES[view] && <Stub page={PAGES[view]} back={() => go('home')} />}

      {/* 底部 Tab */}
      {showTabs && (
        <nav className="tabbar glass3">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-item ${view === t.key ? 'active' : ''}`}
              onClick={() => go(t.key)}
            >
              <span className="tab-icon">
                {t.icon}
                {t.key === 'diary' && diaryDot && <i className="tab-dot" />}
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* More 弹层 */}
      {moreOpen && (
        <div className="sheet-mask" onClick={() => setMoreOpen(false)}>
          <div className="sheet glass3-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            {MORE_ITEMS.map((it) => (
              <button key={it.key} className="sheet-item more-item" onClick={() => go(it.key)}>
                <span className="serif">{it.label}</span>
                <span className="more-sub">{it.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CommandWidget />
      <CallOverlay />
      <Sidebar
        open={sidebarOpen}
        close={() => setSidebarOpen(false)}
        go={go}
        current={view}
      />
    </>
  )
}
