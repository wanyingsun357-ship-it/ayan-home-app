import { useEffect, useState } from 'react'
import { useShopping, money, shoppingStates } from '../utils/useShopping.js'
import { compressImage, postUpload } from '../utils/compressImage.js'
import './footprints.css'
import './shopping.css'

const filters = { all: '全部', saved: '心愿', active: '进行中', paid: '已买', closed: '未完成' }
const active = ['browsing', 'cart', 'checkout', 'payment_pending']
export default function Shopping({ back, openLedger, initial = {} }) {
  const { data, error, loading, saving, load, post } = useShopping()
  const [filter, setFilter] = useState('all'), [selection, setSelection] = useState(initial.orderId || ''), [form, setForm] = useState(null)
  const [notice, setNotice] = useState('')
  const [uploading, setUploading] = useState(false)
  const attachScreenshot = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/^image\/(?:png|jpeg|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setNotice('请选择 10MB 以内的 PNG、JPEG 或 WebP 图片。'); return }
    setUploading(true); setNotice('')
    try { const image = await compressImage(file); const uploaded = await postUpload(image.name, image.base64); setForm(previous => previous ? { ...previous, screenshot: uploaded.url } : previous) }
    catch { setNotice('截图上传失败，其他内容还在，可以重新选择图片。') }
    finally { setUploading(false) }
  }
  useEffect(() => { if (!loading && data && initial.orderId && !data.orders.some(o => o.id === initial.orderId)) setNotice('这条购物记录暂时没有取到，下面可以查看其他记录。') }, [data, loading, initial.orderId])
  const orders = (data?.orders || []).filter(o => (!initial.session || o.session === initial.session || o.id === initial.orderId) && (filter === 'all' || filter === 'active' && active.includes(o.status) || filter === 'paid' && ['paid', 'refunded'].includes(o.status) || filter === 'closed' && ['failed', 'cancelled'].includes(o.status) || filter === 'saved' && o.status === 'saved'))
  const edit = item => setForm(item ? { ...item, amount: item.amountCents ? (item.amountCents / 100).toFixed(2) : '', activity: '', screenshot: '', paymentNote: item.paymentNote || '' } : { clientId: crypto.randomUUID(), title: '', url: '', platform: '', category: '购物', amount: '', quantity: 1, note: '', status: 'saved', session: initial.session || '', activity: '', screenshot: '', paymentNote: '' })
  return <section className="footprints shopping">
    <header className="fp-head"><button className="fp-back" onClick={back} aria-label="返回 Footprints">‹</button><div><h1 className="serif">Shopping</h1><p>他挑过、惦记着和买下的东西。</p></div><button className="fp-refresh" onClick={load} disabled={loading} aria-label="刷新购物记录">↻</button></header>
    <div className="shop-content">
      <div className="shop-overview glass1"><div><span className="shop-caption">晏白的账本余额</span><strong className="serif">{data ? money(data.balanceCents) : '—'}</strong></div><button className="tg-nav" onClick={openLedger}>打开账本 ↗</button></div>
      <div className="shop-toolbar"><nav className="shop-filters" aria-label="按购物状态筛选">{Object.entries(filters).map(([key, label]) => <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}</button>)}</nav><button className="tg-btn ghost" disabled={!data || saving} onClick={() => edit()}>＋ 记下商品</button></div>
      <p className="shop-stage-note">购物记录已开放；实际浏览、下单和支付尚未接通。</p>
      {notice && <p className="shop-stage-note" role="status">{notice}</p>}
      {error && <div className="shop-alert" role="alert">{error}<button className="shop-text-button" onClick={load}>重新读取</button></div>}
      {form && <form className="shop-edit glass1 shop-form" onSubmit={async e => { e.preventDefault(); const result = await post('orders', { ...form, ...(form.screenshot ? {} : { screenshot: undefined }) }); if (result) { setSelection(result.order.id); setFilter('all'); setForm(null) } }}>
        <h2 className="serif shop-form-title">{form.id ? '更新购物记录' : '记下一件想买的东西'}</h2>
        <label>商品名称<input aria-label="商品名称" required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>商品链接<input aria-label="商品链接" type="url" value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
        <div className="tg-form-row"><label>平台<input aria-label="购物平台" maxLength={100} value={form.platform || ''} onChange={e => setForm({ ...form, platform: e.target.value })} placeholder="京东" /></label><label>分类<input aria-label="商品分类" maxLength={30} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></label></div>
        <div className="tg-form-row"><label>整单金额<input aria-label="商品金额" type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} readOnly={['paid', 'refunded'].includes(data?.orders.find(o => o.id === form.id)?.status)} /></label><label>数量<input aria-label="商品数量" type="number" min="1" max="999" step="1" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></label></div>
        <label>当前状态<select aria-label="购物状态" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(shoppingStates).filter(([status]) => { const old = data?.orders.find(o => o.id === form.id)?.status; return old === 'refunded' ? status === 'refunded' : old === 'paid' ? ['paid', 'refunded'].includes(status) : status !== 'refunded' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>备注<textarea aria-label="购物备注" maxLength={1000} rows={2} value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="为什么想买，想送给谁…" /></label>
        <label>这次的活动<input aria-label="购物活动" maxLength={1000} value={form.activity} onChange={e => setForm({ ...form, activity: e.target.value })} placeholder="比较了款式，还想再看看" /></label>
        <details className="shop-extra"><summary>订单与截图</summary><label>订单号<input aria-label="商家订单号" maxLength={200} value={form.merchantOrderId || ''} onChange={e => setForm({ ...form, merchantOrderId: e.target.value })} /></label><label>{uploading ? '截图上传中…' : form.screenshot ? '截图已附上，可重新选择' : '附上截图'}<input aria-label="购物截图" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={attachScreenshot} /></label>{form.screenshot && <img className="shop-upload-preview" src={form.screenshot} alt="本次附上的购物截图" />}</details>
        {form.status === 'paid' && <label>付款凭据说明<input aria-label="付款凭据说明" value={form.paymentNote} onChange={e => setForm({ ...form, paymentNote: e.target.value })} placeholder="核实付款的依据；填过订单号可留空" /><small>仅在实际付款后登记，会自动记入晏白的支出。</small></label>}
        {form.status === 'refunded' && <p className="shop-stage-note">确认实际全额退款后保存，账本会自动增加退款收入。</p>}
        <div className="tg-actions"><button type="button" className="tg-btn ghost" disabled={saving || uploading} onClick={() => setForm(null)}>取消</button><button className="tg-btn" disabled={saving || uploading}>{uploading ? '截图上传中…' : saving ? '保存中…' : '保存记录'}</button></div>
      </form>}
      {loading && !data && <p className="fp-empty" role="status">正在翻看购物记录…</p>}
      {!loading && !error && !orders.length && <div className="shop-empty glass1"><span aria-hidden="true">♧</span><h2 className="serif">{filter === 'all' ? '想买的东西，慢慢记在这里。' : '这个分类下还没有记录。'}</h2><p>商品、截图和实际发生的活动，都会留在这一本里。</p></div>}
      <div className="shop-orders">{orders.map(item => <article className={`shop-order glass1 ${selection === item.id ? 'expanded' : ''}`} key={item.id}>
        <button className="shop-order-summary" aria-expanded={selection === item.id} onClick={() => setSelection(selection === item.id ? '' : item.id)}><span className="shop-order-symbol" aria-hidden="true">♧</span><span className="shop-order-heading"><strong>{item.title}</strong><small>{item.platform || '商品'} · {item.category || '购物'} · {item.quantity || 1} 件</small></span><span className="shop-order-side"><em className={item.status}>{shoppingStates[item.status] || '已记录'}</em><b>{item.amountCents ? money(item.amountCents) : '金额待定'}</b></span></button>
        {selection === item.id && <div className="shop-order-detail">
          {item.note && <p className="shop-order-note">{item.note}</p>}
          {item.url && <a className="shop-text-button" href={item.url} target="_blank" rel="noopener noreferrer">打开商品 ↗</a>}
          {item.merchantOrderId && <p className="shop-stage-note">订单号：{item.merchantOrderId}</p>}
          {item.paymentNote && <p className="shop-stage-note">付款说明：{item.paymentNote}</p>}
          {!!item.screenshots?.length && <div className="shop-screenshots">{item.screenshots.map(src => <a href={src} target="_blank" rel="noopener noreferrer" key={src}><img src={src} loading="lazy" alt={`${item.title}的操作截图`} /></a>)}</div>}
          <ol className="shop-history">{item.events?.map(ev => <li key={ev.id}><span className="shop-event-dot" /><div><p>{ev.text}</p><time dateTime={ev.at}>{new Date(ev.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {shoppingStates[ev.status] || '已记录'}</time></div></li>)}</ol>
          <div className="tg-actions"><button className="tg-btn ghost" onClick={() => edit(item)}>编辑记录</button>{['paid', 'refunded'].includes(item.status) && <button className="tg-btn ghost" onClick={openLedger}>查看账本</button>}</div>
        </div>}
      </article>)}</div>
    </div>
  </section>
}
