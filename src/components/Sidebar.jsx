import { useAppearance, appearanceChange } from '../utils/appearance.js'
import { VERSION, HOME_NAME } from '../config.js'
import './sidebar.css'

const ITEMS = [
  { key: 'home', label: 'Home', sub: '回到主页' },
  { key: 'chat', label: 'Chat', sub: '和晏白说话' },
  { key: 'memory', label: 'Memory', sub: '记忆库' },
  { key: 'moments', label: 'Moments', sub: '朋友圈' },
  { key: 'diary', label: 'Diary', sub: '日记' },
  { key: 'together', label: 'Together', sub: '一起过日子' },
  { key: 'footprints', label: 'Footprints', sub: '醒来后的活动' },
  { key: 'gallery', label: 'Gallery', sub: '相册' },
  { key: 'mind', label: 'Mind', sub: '' },
]

export default function Sidebar({ open, close, go, current }) {
  const appearance = useAppearance()
  const theme = appearance.profiles[appearance.theme].mode

  const toggleTheme = () => {
    const next = theme === 'night' ? 'day' : 'night'
    appearanceChange(s => { s.profiles[s.theme].mode = next; return s })
  }

  return (
    <>
      <div className={`sb-backdrop ${open ? 'show' : ''}`} onClick={close} />
      <aside className={`sb ${open ? 'open' : ''}`}>
        <div className="sb-head serif">{HOME_NAME}</div>

        <nav className="sb-nav">
          {ITEMS.map((it) => (
            <button
              key={it.key}
              className={`sb-item ${current === it.key ? 'active' : ''}`}
              onClick={() => go(it.key)}
            >
              <span className="serif sb-label">{it.label}</span>
              {it.sub && <span className="sb-sub">{it.sub}</span>}
            </button>
          ))}
        </nav>

        <div className="sb-bottom">
          <button className="sb-item" onClick={toggleTheme}>
            <span className="serif sb-label">{theme === 'night' ? 'Day' : 'Night'}</span>
            <span className="sb-sub">{theme === 'night' ? '切到日间' : '切到夜间'}</span>
          </button>
          <button
            className={`sb-item ${current === 'settings' ? 'active' : ''}`}
            onClick={() => go('settings')}
          >
            <span className="serif sb-label">Settings</span>
            <span className="sb-sub">make it yours</span>
          </button>
          <div className="sb-ver">{HOME_NAME} &middot; {VERSION}</div>
        </div>
      </aside>
    </>
  )
}
