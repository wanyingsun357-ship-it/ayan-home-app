import { useEffect, useState } from 'react'
import { VERSION, HOME_NAME } from '../config.js'
import { isApp, geo } from '../utils/native.js'
import './stub.css'
import './settings.css'

export default function Settings({ back }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme)
  const [mcp, setMcp] = useState({ builtin: [], custom: [] })
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [obPw, setObPw] = useState('')
  const [obState, setObState] = useState(null)
  const [obMsg, setObMsg] = useState('')

  const loadOb = async () => {
    try {
      const r = await fetch('/api/ombre/status')
      setObState(await r.json())
    } catch {}
  }
  const saveObPw = async () => {
    if (!obPw.trim()) return
    setObMsg('连接中…')
    try {
      const r = await fetch('/api/ombre/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: obPw.trim() }),
      })
      const d = await r.json()
      setObMsg(d.success ? '连上了,记忆库醒着 ✓' : (d.error || '没连上'))
      if (d.success) { setObPw(''); loadOb() }
    } catch { setObMsg('没连上,稍后再试') }
  }

  const setMode = (mode) => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem('theme', mode)
    setTheme(mode)
  }

  const loadMcp = async () => {
    try {
      const r = await fetch('/api/mcp')
      setMcp(await r.json())
    } catch {}
  }
  useEffect(() => {
    loadMcp(); loadOb(); loadHealth()
  }, [])

  // ---- 定位:授权、开关、把这里设为家 ----
  const [loc, setLoc] = useState(null)
  const [locAuth, setLocAuth] = useState('')
  const [locMsg, setLocMsg] = useState('')
  const [locOn, setLocOn] = useState(localStorage.getItem('loc-on') !== '0')
  const loadLoc = async () => { try { setLoc(await (await fetch('/api/location')).json()) } catch {}; try { setLocAuth((await geo.status()).auth) } catch {} }
  useEffect(() => { loadLoc() }, [])
  const locAsk = async (always) => { const r = await geo.request(always); setLocAuth(r.auth); if (r.auth === 'always' || r.auth === 'whenInUse') { await geo.report(); if (r.auth === 'always') geo.startBackground(); setTimeout(loadLoc, 1500) } }
  const locNow = async () => { setLocMsg('定位中…'); const r = await geo.report(); setLocMsg(r ? '已上报' : '没拿到位置'); setTimeout(() => { setLocMsg(''); loadLoc() }, 1500) }
  const locSetHome = async () => { if (!loc?.last) { setLocMsg('先上报一次位置'); return } if (!confirm('把最近一次上报的位置设为"家"?他会以此判断你回没回来')) return; await fetch('/api/location/home', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ useLast: true, name: '家' }) }); loadLoc() }
  const locClearHome = async () => { await fetch('/api/location/home', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: null }) }); loadLoc() }
  const locToggle = async () => { const v = !locOn; setLocOn(v); localStorage.setItem('loc-on', v ? '1' : '0'); await fetch('/api/location/enabled', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: v }) }); if (!v) geo.stopBackground(); loadLoc() }
  const ago = (iso) => { if (!iso) return '还没上报过'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前` }

  // ---- 用量:Claude 订阅窗口(桥用他的登录态查) + ElevenLabs 积分 ----
  const [usage, setUsage] = useState(null)
  const loadUsage = async () => { try { setUsage(await (await fetch('/api/usage')).json()) } catch {} }
  useEffect(() => { loadUsage() }, [])
  const resetIn = (iso) => {
    if (!iso) return ''
    const ms = new Date(iso) - Date.now(); if (ms <= 0) return '快重置了'
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
    if (h >= 24) { const d = new Date(iso); return `${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} 重置` }
    return `${h ? h + ' 小时 ' : ''}${m} 分钟后重置`
  }
  const Bar = ({ label, sub, pct }) => (
    <div className="use-row">
      <div className="use-head"><span>{label}</span><span className="use-pct">{pct == null ? '—' : Math.round(pct) + '%'}</span></div>
      <div className="use-bar"><b style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} className={pct >= 85 ? 'hot' : pct >= 60 ? 'warm' : ''} /></div>
      {sub && <div className="use-sub">{sub}</div>}
    </div>
  )

  // ---- 热词表:语音识别优先认的词(人名/常用词),存桥 → 同步阿里 ----
  const [hw, setHw] = useState(null)
  const [hwNew, setHwNew] = useState('')
  const [hwMsg, setHwMsg] = useState('')
  const loadHw = async () => { try { setHw(await (await fetch('/api/hotwords')).json()) } catch {} }
  useEffect(() => { loadHw() }, [])
  const saveHw = async (words) => {
    setHwMsg('同步中…')
    try {
      const r = await fetch('/api/hotwords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) })
      const d = await r.json()
      setHw(d.hotwords || hw); setHwMsg(r.ok ? '已同步到识别引擎 ✓' : ('没同步上:' + (d.error || '')))
    } catch { setHwMsg('没同步上') }
    setTimeout(() => setHwMsg(''), 3000)
  }
  const hwAdd = () => { const t = hwNew.trim(); if (!t || !hw) return; if (hw.words.some((w) => w.text === t)) { setHwNew(''); return }; setHwNew(''); saveHw([...hw.words, { text: t, weight: 4, lang: /^[a-zA-Z ]+$/.test(t) ? 'en' : 'zh' }]) }
  const hwDel = (t) => hw && saveHw(hw.words.filter((w) => w.text !== t))
  const hwWeight = (t, d) => hw && saveHw(hw.words.map((w) => (w.text === t ? { ...w, weight: Math.min(5, Math.max(1, (w.weight || 4) + d)) } : w)))

  // ---- 记忆系统健康 + 流水账 ----
  const [health, setHealth] = useState(null)
  const [ledger, setLedger] = useState(null)
  const loadHealth = async () => {
    try { setHealth(await (await fetch('/api/health')).json()) } catch {}
  }
  const loadLedger = async () => {
    try { setLedger(await (await fetch('/api/echo/log')).json()) } catch {}
  }
  const flagMiss = async (logId) => {
    const note = prompt('这里他该想起什么?(会存进漏召回日志,用来以后调灵敏度)')
    if (!note || !note.trim()) return
    await fetch('/api/echo/flag', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, note: note.trim() }),
    }).catch(() => {})
    flash('记下了')
    loadLedger()
  }
  const ago = (iso) => {
    if (!iso) return '从未'
    const m = Math.round((Date.now() - new Date(iso)) / 60000)
    if (m < 60) return `${m}分钟前`
    if (m < 1440) return `${Math.round(m / 60)}小时前`
    return `${Math.round(m / 1440)}天前`
  }
  const light = (bad, warn) => (bad ? '🔴' : warn ? '🟡' : '🟢')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  const addMcp = async () => {
    if (!newName.trim() || !newUrl.trim()) return
    const r = await fetch('/api/mcp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), url: newUrl.trim() }),
    }).catch(() => null)
    if (r?.ok) {
      setNewName(''); setNewUrl(''); setAdding(false)
      flash('接上了,下一条消息他就能用')
      loadMcp()
    } else {
      const e = r ? await r.json().catch(() => ({})) : {}
      flash(e.error || '没接上,检查一下地址')
    }
  }

  const toggleMcp = async (c) => {
    await fetch(`/api/mcp/${encodeURIComponent(c.name)}/toggle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !c.enabled }),
    }).catch(() => {})
    loadMcp()
  }

  const delMcp = async (c) => {
    if (!confirm(`删除连接器「${c.name}」?`)) return
    await fetch(`/api/mcp/${encodeURIComponent(c.name)}`, { method: 'DELETE' }).catch(() => {})
    loadMcp()
  }

  return (
    <div className="stub">
      <header className="stub-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div>
          <div className="serif stub-title">Settings</div>
          <div className="stub-sub">make it yours</div>
        </div>
      </header>

      <div className="set-list">
        <div className="set-group">
          <div className="set-group-name">外观</div>
          <div className="set-row">
            <span>主题</span>
            <div className="set-seg">
              <button className={theme === 'day' ? 'on' : ''} onClick={() => setMode('day')}>日间</button>
              <button className={theme === 'night' ? 'on' : ''} onClick={() => setMode('night')}>夜间</button>
            </div>
          </div>
          <div className="set-row set-slider-row">
            <span>背景强度</span>
            <input
              type="range" min="0" max="0.4" step="0.02"
              defaultValue={localStorage.getItem('bg-dim') || 0}
              onChange={(e) => {
                document.documentElement.style.setProperty('--bg-dim', e.target.value)
                localStorage.setItem('bg-dim', e.target.value)
              }}
            />
          </div>
          <div className="set-row set-slider-row">
            <span>玻璃透明度</span>
            <input
              type="range" min="0.75" max="1.35" step="0.05"
              defaultValue={localStorage.getItem('glass-k') || 1}
              onChange={(e) => {
                document.documentElement.style.setProperty('--gk', e.target.value)
                localStorage.setItem('glass-k', e.target.value)
              }}
            />
          </div>
        </div>

        <div className="set-group">
          <div className="set-group-name">位置 · 他知道你在哪</div>
          <div className="set-row">
            <span>上报位置给他</span>
            <div className="set-seg"><button className={locOn ? 'on' : ''} onClick={locToggle}>{locOn ? '开' : '关'}</button></div>
          </div>
          {isApp() ? (
            <>
              {(locAuth === 'prompt' || locAuth === 'denied') && (
                <div className="set-row"><span className="set-dim">{locAuth === 'denied' ? '权限被拒了,去系统设置里打开' : '还没授权'}</span><div className="set-seg"><button onClick={() => locAsk(false)}>使用时</button><button onClick={() => locAsk(true)}>始终</button></div></div>
              )}
              {locAuth === 'whenInUse' && <div className="set-row"><span className="set-dim">权限:使用 App 时。选"始终"他才能在你回宿舍时迎你</span><div className="set-seg"><button onClick={() => locAsk(true)}>改为始终</button></div></div>}
              {locAuth === 'always' && <div className="set-row"><span className="set-dim">权限:始终 · 后台只在你明显移动时上报</span><div className="set-seg"><button onClick={locNow}>{locMsg || '现在上报'}</button></div></div>}
            </>
          ) : <div className="set-hint">网页版拿不到定位,装 App 后在这里授权。</div>}
          <div className="set-row">
            <span className="set-dim">最近一次:{loc?.last ? `${ago(loc.last.at)} · 精度 ${loc.last.acc ?? '?'} 米` : '还没上报过'}{loc?.home && loc?.dist != null ? ` · 离家 ${loc.dist < 1000 ? loc.dist + ' 米' : (loc.dist / 1000).toFixed(1) + ' 公里'}` : ''}</span>
          </div>
          <div className="set-row">
            <span>{loc?.home ? `家:已设(${loc.home.name})` : '家:还没设'}</span>
            <div className="set-seg">{loc?.home ? <button onClick={locClearHome}>清掉</button> : null}<button onClick={locSetHome}>把这里设为家</button></div>
          </div>
          <div className="set-hint">他会在"此刻状态"里看到"在家 / 离家 N 米(几分钟前)";你从外面回到家 200 米内,他会主动来迎一下(90 分钟最多一次)。</div>
        </div>

        <div className="set-group">
          <div className="set-group-name">用量 · Usage{usage?.claude?.plan ? ` · ${usage.claude.plan.toUpperCase()}` : ''}</div>
          {!usage ? <div className="set-hint">读取中…</div> : (
            <>
              {usage.claude ? (
                <>
                  <Bar label="当前 5 小时窗口" pct={usage.claude.session?.pct} sub={resetIn(usage.claude.session?.resetsAt)} />
                  <Bar label="本周 · 全部模型" pct={usage.claude.week?.pct} sub={resetIn(usage.claude.week?.resetsAt)} />
                  {usage.claude.weekOpus && <Bar label="本周 · Opus" pct={usage.claude.weekOpus.pct} sub={resetIn(usage.claude.weekOpus.resetsAt)} />}
                </>
              ) : <div className="set-hint">Claude 用量没拿到{usage.claudeError ? `(${usage.claudeError})` : ''}</div>}
              {usage.eleven ? (
                <Bar label={`ElevenLabs 积分 · ${usage.eleven.tier || ''}`} pct={usage.eleven.limit ? usage.eleven.used / usage.eleven.limit * 100 : null} sub={`${(usage.eleven.used || 0).toLocaleString()} / ${(usage.eleven.limit || 0).toLocaleString()}${usage.eleven.resetsAt ? ' · ' + resetIn(usage.eleven.resetsAt) : ''}`} />
              ) : <div className="set-hint">ElevenLabs 积分要在它官网看(这把 key 没开"读取用户信息"权限)</div>}
              <div className="set-hint use-foot"><span>{usage.fetchedAt ? `更新于 ${new Date(usage.fetchedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span><button onClick={loadUsage}>刷新</button></div>
            </>
          )}
        </div>

        <div className="set-group">
          <div className="set-group-name">语音识别 · 热词</div>
          <div className="set-hint">这些词识别时会优先认出来:人名、你们的黑话、老写错的词。权重 1~5,越高越"偏心",人名 4 就够。</div>
          {!hw ? <div className="set-hint">读取中…</div> : (
            <>
              <div className="hw-list">
                {hw.words.map((w) => (
                  <span key={w.text} className="hw-chip">
                    <b>{w.text}</b>
                    <button onClick={() => hwWeight(w.text, -1)} disabled={(w.weight || 4) <= 1}>−</button><i>{w.weight || 4}</i><button onClick={() => hwWeight(w.text, 1)} disabled={(w.weight || 4) >= 5}>+</button>
                    <button className="hw-x" onClick={() => hwDel(w.text)}>✕</button>
                  </span>
                ))}
                {!hw.words.length && <span className="set-hint">还没有词</span>}
              </div>
              <div className="hw-add">
                <input value={hwNew} onChange={(e) => setHwNew(e.target.value)} placeholder="加一个词,比如 吴欣然" onKeyDown={(e) => { if (e.key === 'Enter') hwAdd() }} />
                <button onClick={hwAdd} disabled={!hwNew.trim()}>加</button>
              </div>
              <div className="set-hint">{hwMsg || (hw.syncedAt ? `上次同步 ${new Date(hw.syncedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '还没同步过')}</div>
            </>
          )}
        </div>

        <div className="set-group">
          <div className="set-group-name">记忆系统 · 回声库</div>
          {!health ? <div className="set-hint">读取中…</div> : (
            <>
              <div className="set-row">
                <span>{light(health.queue > 0 && health.queueOldestMin > 60, health.queue > 0)} 落库队列</span>
                <span className="set-health-v">{health.queue === 0 ? '空' : `积压${health.queue}条(${health.queueOldestMin}分钟)`} · 库存{health.echoCount}条</span>
              </div>
              <div className="set-row">
                <span>{light(false, health.timeouts24h > 5)} 静默召回</span>
                <span className="set-health-v">24h {health.recalls24h}次 · 想起{health.hits24h}次 · 超时{health.timeouts24h}</span>
              </div>
              <div className="set-row">
                <span>{light(!health.lastBackupAt || Date.now() - new Date(health.lastBackupAt) > 26 * 3600000, false)} 每日备份</span>
                <span className="set-health-v">{ago(health.lastBackupAt)}</span>
              </div>
              {health.alerts.map((a, i) => <div key={i} className="set-alert">⚠ {a}</div>)}
              <div className="set-hint">回声库的内容搬去 Memory 页了——顶部切到「回声」,看状态、钉住、手动修正都在那边。</div>
              <button className="set-ledger-btn" onClick={() => (ledger ? setLedger(null) : loadLedger())}>
                {ledger ? '收起流水账' : '☰ 记忆流水账'}
              </button>
              {ledger && (
                <div className="set-ledger">
                  {ledger.entries.filter((e) => e.type === 'recall' || e.type === 'ingest').slice(0, 25).map((e) => (
                    <div key={e.id} className="set-ledger-row">
                      <span className="set-ledger-time">{new Date(e.at).toTimeString().slice(0, 5)}</span>
                      {e.type === 'ingest' && <span>📥 入库{e.n}条</span>}
                      {e.type === 'recall' && e.n > 0 && <span>💭「{e.q}」→ 想起{e.n}条({(e.scores || []).join(',')})</span>}
                      {e.type === 'recall' && !e.n && (
                        <span className="set-ledger-miss">
                          「{e.q}」→ {e.miss === 'timeout' ? '超时' : `没想起(最高${e.top})`}
                          <button className="set-flag-btn" onClick={() => flagMiss(e.id)}>该想起某事</button>
                        </span>
                      )}
                    </div>
                  ))}
                  {ledger.entries.length === 0 && <div className="set-hint">还没有记录——从下一次压缩/聊天开始积累。</div>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="set-group">
          <div className="set-group-name">记忆库 · Ombre Brain</div>
          <div className="set-row">
            <span>面板连接</span>
            <span className={obState?.available ? 'set-check' : 'set-dim'}>
              {obState?.available ? `✓ ${obState.total} memories` : obState?.configured === false ? '未配置' : '未连接'}
            </span>
          </div>
          <div className="set-obpw">
            <input
              type="password"
              placeholder="Dashboard 密码(只存在自己服务器)"
              value={obPw}
              onChange={(e) => setObPw(e.target.value)}
            />
            <button onClick={saveObPw} disabled={!obPw.trim()}>连接</button>
          </div>
          {obMsg && <div className="set-msg">{obMsg}</div>}
        </div>

        <div className="set-group">
          <div className="set-group-name">连接器 · Connectors</div>
          {mcp.builtin.map((b) => (
            <div className="set-row" key={b.name}>
              <span>
                {b.name}
                <span className="set-note">{b.note}</span>
              </span>
              <span className="set-check">✓</span>
            </div>
          ))}
          {mcp.custom.map((c) => (
            <div className="set-row" key={c.name}>
              <span>
                {c.name}
                <span className="set-note">{c.url}</span>
              </span>
              <span className="set-mcp-btns">
                <button
                  className={`set-toggle ${c.enabled ? 'on' : ''}`}
                  onClick={() => toggleMcp(c)}
                ><i /></button>
                <button className="set-del" onClick={() => delMcp(c)}>×</button>
              </span>
            </div>
          ))}
          {adding ? (
            <div className="set-addform">
              <input placeholder="名称(比如 天气)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input placeholder="https://…/mcp" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <div className="set-addrow">
                <button className="set-cancel" onClick={() => setAdding(false)}>取消</button>
                <button className="set-ok" onClick={addMcp}>接上</button>
              </div>
            </div>
          ) : (
            <button className="set-add" onClick={() => setAdding(true)}>+ 添加自定义连接器</button>
          )}
          <div className="set-hint">
            Ombre Brain / Gmail / 高德是 claude.ai 账号连接器,去 claude.ai 的 Connectors 面板管理。
            这里添加的是 VPS 本地连接器,只支持 Streamable HTTP 地址。
          </div>
          {msg && <div className="set-msg">{msg}</div>}
        </div>

        <div className="set-about">{HOME_NAME} &middot; {VERSION}</div>
      </div>
    </div>
  )
}
