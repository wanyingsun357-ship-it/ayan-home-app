import { useEffect, useRef, useState } from 'react'
import ShoppingImage from './ShoppingImage.jsx'

const loginLabels = { needed: '等待扫码登录', unverified: '已收到登录状态，待核对', confirmed: '已确认京东登录' }
export default function ShoppingBrowserPanel({ onChanged, selectedOrder, onSaved }) {
  const [state, setState] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [query, setQuery] = useState(''), [products, setProducts] = useState([]), [screen, setScreen] = useState(0), [showScreen, setShowScreen] = useState(false), [manual, setManual] = useState(false), [code, setCode] = useState('')
  const pending = useRef(false), live = useRef(true), request = useRef(0)
  const read = async () => { const id = ++request.current; try { const r = await fetch('/api/shopping/browser', { cache: 'no-store' }); if (!r.ok) throw Error('购物浏览器暂时没有连接'); const d = await r.json(); if (live.current && id === request.current) setState(d) } catch (e) { if (live.current && id === request.current) setError(e.message) } }
  useEffect(() => { live.current = true; read(); const refresh = () => { if (!document.hidden && !pending.current) read() }; document.addEventListener('visibilitychange', refresh); window.addEventListener('shopping:changed',refresh); return () => { live.current = false; request.current++; document.removeEventListener('visibilitychange', refresh);window.removeEventListener('shopping:changed',refresh) } }, [])
  const act = async (action, body = {}) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const r = await fetch('/api/shopping/browser/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) }); const d = await r.json()
      if (!r.ok || !d.ok) throw Error(d.error || '这次操作暂时没有完成')
      if (!live.current) return
      setState(d.state); if (d.products) setProducts(d.products)
      if (d.message) setError(d.message)
      if (d.state.running) { setScreen(Date.now()); setShowScreen(true) } else setShowScreen(false)
      if (action === 'loginCode') setCode('')
      await onChanged?.(); await read()
      return d
    } catch (e) { if (live.current) { setError(e.message); setScreen(Date.now()) } }
    finally { pending.current = false; if (live.current) setBusy(false) }
  }
  const loginPage = state?.loginPage || /\b(?:passport|safe|aq)\.jd\.com\b/.test(state?.url || '')
  const capture = async event => { if (!manual || !loginPage || busy) return; const rect = event.currentTarget.getBoundingClientRect(); await act('loginClick', { x: (event.clientX - rect.left) * 1280 / rect.width, y: (event.clientY - rect.top) * 900 / rect.height }) }
  return <div className="shop-browser glass1">
    <div className="shop-browser-head"><div><h2 className="serif">京东 · 逛一逛</h2><p>{state?.available ? state.running ? loginLabels[state.login] || '浏览器已打开' : '需要时再打开浏览器' : '正在准备浏览器连接'}</p></div>{state?.running && <button className="tg-nav" disabled={busy} onClick={() => act('close')}>关闭浏览器</button>}</div>
    <div className="shop-actions"><button className="tg-btn" disabled={busy || !state?.available} onClick={() => act('login')}>{busy ? '正在打开…' : state?.login === 'confirmed' ? '重新登录' : '扫码登录京东'}</button><button className="tg-btn ghost" disabled={busy || !state?.available} onClick={() => act('check')}>检查登录</button><button className="tg-btn ghost" disabled={busy || !state?.available} onClick={() => act('cart')}>查看购物车</button></div>
    <p className="shop-stage-note">现在支持找商品、查看和单件加购；下单与付款暂未开放。</p>
    {error && <p className="shop-alert" role="alert">{error}</p>}
    {state?.error && !error && <p className="shop-stage-note">{state.error}</p>}
    {loginPage && showScreen && <div className="shop-login-qr"><ShoppingImage src={`/api/shopping/browser/qr?v=${screen}`} alt="京东扫码登录二维码" /><p>用京东 App 扫码并确认。二维码过期后，点下面刷新。</p><button className="tg-nav" disabled={busy} onClick={() => act('refresh')}>刷新二维码</button></div>}
    {state?.running && <><div className="shop-actions"><button className="shop-text-button" onClick={() => { setShowScreen(!showScreen); setScreen(Date.now()) }}>{showScreen ? '收起操作画面' : '看看操作画面'}</button>{showScreen && <button className="shop-text-button" disabled={busy} onClick={() => setScreen(Date.now())}>刷新画面</button>}</div>{showScreen && <div className={`shop-live-screen ${manual && loginPage ? 'manual' : ''}`} onClick={capture}><ShoppingImage src={`/api/shopping/browser/screen?v=${screen}`} alt="京东浏览器当前画面" /></div>}</>}
    {loginPage && showScreen && <details className="shop-login-manual"><summary onClick={() => setManual(!manual)}>京东要求额外验证？</summary><p className="shop-stage-note">展开后可点上面的操作画面。需要短信验证码时，先点画面中的输入框，再在这里填写。</p><div className="shop-search-form"><input aria-label="京东短信验证码" value={code} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><button className="tg-nav" disabled={busy || !/^\d{4,8}$/.test(code)} onClick={() => act('loginCode', { code })}>输入验证码</button></div></details>}
    <form className="shop-search-form" onSubmit={e => { e.preventDefault(); act('search', { query }) }}><input aria-label="京东商品搜索" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} placeholder="想找什么东西？" /><button className="tg-nav" disabled={busy || !state?.available || !query.trim()}>去看看</button></form>
    {products.length > 0 && <div className="shop-search-results">{products.map(product => <div key={product.skuId}><div><strong>{product.title}</strong><small>{product.price ? '页面价格 ¥' + product.price : '打开商品查看价格'}</small></div><button className="tg-nav" disabled={busy} onClick={async () => { if (pending.current) return; pending.current = true; setBusy(true); try { const r = await fetch('/api/shopping/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: product.title, url: product.url, platform: '京东', ...(product.price ? { amount: product.price } : {}), quantity: 1, clientId: crypto.randomUUID(), by: 'wanying', status: 'saved' }) }); const d = await r.json(); if (!r.ok) throw Error(d.error); await onChanged?.(); onSaved?.(d.order.id) } catch (e) { setError(e.message) } finally { pending.current = false; setBusy(false) } }}>记下</button><button className="tg-nav" disabled={busy} onClick={() => act('open', { skuId: product.skuId })}>查看</button></div>)}</div>}
    {selectedOrder?.url?.match(/^https:\/\/item\.jd\.com\/\d+\.html/) && <div className="shop-browser-selected"><p className="shop-stage-note">当前选中：{selectedOrder.title}</p><div className="shop-actions"><button className="tg-nav" disabled={busy || !state?.available} onClick={() => act('open', { orderId: selectedOrder.id })}>在浏览器查看</button><button className="tg-nav" disabled={busy || !state?.available || state?.login !== 'confirmed' || ['cart', 'paid', 'refunded'].includes(selectedOrder.status)} onClick={() => act('add', { orderId: selectedOrder.id, clientId: crypto.randomUUID() })}>加入购物车</button></div></div>}
    {!!state?.activities?.length && <details className="shop-browser-history"><summary>最近逛过的地方</summary><ol className="shop-history">{state.activities.slice(0, 12).map(a => <li key={a.id}><span className="shop-event-dot" /><div><p>{a.summary}</p><time>{new Date(a.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {a.status === 'completed' ? '已完成' : a.status === 'unconfirmed' ? '待核对' : '未完成'}</time>{a.screenshot && <ShoppingImage src={a.screenshot} alt="这次购物活动的截图" loading="lazy" />}</div></li>)}</ol></details>}
  </div>
}
