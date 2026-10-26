import { useState } from 'react'
import { useShopping, shoppingDay, money } from '../utils/useShopping.js'
import '../pages/shopping.css'

const types = { income: '收入', expense: '支出', refund: '退款' }
const monthStep = (month, n) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7) }
export default function ShoppingLedger({ openShopping }) {
  const { data, error, loading, saving, load, post } = useShopping()
  const [month, setMonth] = useState(shoppingDay().slice(0, 7)), [form, setForm] = useState(null), [selected, setSelected] = useState(''), [settings, setSettings] = useState(null)
  const records = (data?.entries || []).filter(e => e.date.startsWith(month)).sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at))
  const sum = type => records.filter(e => e.type === type).reduce((n, e) => n + e.amountCents, 0)
  const groups = {}, categories = {}
  for (const e of records) { (groups[e.date] ||= []).push(e); if (e.type === 'expense') categories[e.category] = (categories[e.category] || 0) + e.amountCents }
  const begin = (type, item) => { setSettings(null); setForm(item ? { ...item, amount: (item.amountCents / 100).toFixed(2) } : { clientId: crypto.randomUUID(), type, amount: '', category: type === 'income' ? '零花钱' : type === 'refund' ? '退款' : '购物', note: '', date: shoppingDay() }) }
  return <div className="shopping-ledger">
    <div className="tg-card glass2 shop-wallet">
      <div className="tg-card-head"><span className="serif">晏白的账本</span><button className="tg-nav" onClick={() => { if (!data) return; setForm(null); setSettings({ categories: data.categories.join('、'), monthlyPlan: String((data.monthlyPlanCents || 0) / 100) }) }} disabled={!data || saving}>自定义</button></div>
      <span className="shop-caption">账本余额</span><div className="tg-total serif" data-testid="wallet-balance">{data ? money(data.balanceCents) : '—'}</div>
      <div className="shop-actions"><button className="tg-btn" disabled={!data || saving} onClick={() => begin('income')}>＋ 给他汇款</button><button className="tg-btn ghost" disabled={!data || saving} onClick={() => begin('expense')}>＋ 记一笔</button></div>
      <p className="tg-sum-note">汇款在这里记为收入，实际充值由你完成。余额按全部已记收支计算。</p>
      {!!data?.monthlyPlanCents && <p className="tg-sum-note">每月零花钱计划 {money(data.monthlyPlanCents)} · 到账后再记入</p>}
      <button className="shop-text-button" onClick={() => openShopping?.()}>去 Shopping 看购物记录 ↗</button>
    </div>
    {error && <div className="shop-alert" role="alert">{error}<button className="shop-text-button" onClick={load}>重新读取</button></div>}
    {loading && !data && <p className="tg-empty" role="status">正在翻开账本…</p>}
    {settings && <form className="tg-card glass2 tg-form shop-form" onSubmit={async e => { e.preventDefault(); const result = await post('settings', { categories: settings.categories.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean), monthlyPlan: settings.monthlyPlan }); if (result) setSettings(null) }}>
      <h3 className="shop-form-title serif">账本设置</h3><label>每月零花钱计划<input aria-label="每月零花钱计划" type="number" min="0" step="0.01" inputMode="decimal" value={settings.monthlyPlan} onChange={e => setSettings({ ...settings, monthlyPlan: e.target.value })} required /></label>
      <label>自定义分类<input aria-label="自定义分类" value={settings.categories} onChange={e => setSettings({ ...settings, categories: e.target.value })} placeholder="购物、礼物、生活、零花钱" required /></label><p className="tg-sum-note">分类用顿号或逗号分开，历史记录保留原分类。</p>
      <div className="tg-actions"><button type="button" className="tg-btn ghost" disabled={saving} onClick={() => setSettings(null)}>取消</button><button className="tg-btn" disabled={saving}>{saving ? '保存中…' : '保存设置'}</button></div>
    </form>}
    {form && <form className="tg-card glass2 tg-form shop-form" onSubmit={async e => { e.preventDefault(); const result = await post('ledger', { ...form, op: form.id ? 'update' : 'add' }); if (result) setForm(null) }}>
      <h3 className="shop-form-title serif">{form.id ? '编辑这笔记录' : form.type === 'income' ? '给他一笔零花钱' : '记一笔'}</h3>
      <div className="tg-chips" role="group" aria-label="收支类型">{Object.entries(types).map(([type, label]) => <button type="button" className={`tg-chip ${form.type === type ? 'on' : ''}`} key={type} onClick={() => setForm({ ...form, type, category: type === 'income' ? '零花钱' : type === 'refund' ? '退款' : '购物' })}>{label}</button>)}</div>
      <div className="tg-form-row"><label>金额<input aria-label="记账金额" type="number" min="0.01" max="99999999.99" step="0.01" inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>日期<input aria-label="记账日期" type="date" required max={shoppingDay()} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div>
      <label>分类<input aria-label="记账分类" required maxLength={30} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></label>
      <div className="tg-chips">{data?.categories.map(c => <button type="button" key={c} className={`tg-chip ${form.category === c ? 'on' : ''}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>)}</div>
      <label>备注<input aria-label="记账备注" maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder={form.type === 'income' ? '这个月给他的零花钱' : '买了什么，为什么想买'} /></label>
      <div className="tg-actions"><button type="button" className="tg-btn ghost" disabled={saving} onClick={() => setForm(null)}>取消</button><button className="tg-btn" disabled={saving}>{saving ? '保存中…' : '记上'}</button></div>
    </form>}
    <div className="tg-card glass2">
      <div className="tg-card-head"><button className="tg-nav" aria-label="上个月" onClick={() => setMonth(monthStep(month, -1))}>‹</button><span className="serif">{month.replace('-', ' · ')}</span><button className="tg-nav" aria-label="下个月" onClick={() => setMonth(monthStep(month, 1))}>›</button></div>
      <div className="shop-totals">{[['收入', sum('income')], ['支出', sum('expense')], ['退款', sum('refund')]].map(([label, value]) => <div key={label}><span>{label}</span><b>{money(value)}</b></div>)}</div>
      <div className="shop-category-bars">{Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([category, value]) => <div key={category}><span>{category}</span><i><b style={{ width: `${value / (sum('expense') || 1) * 100}%` }} /></i><strong>{money(value)}</strong></div>)}</div>
      {!records.length && !loading && <p className="tg-empty">这个月还没有记账。</p>}
    </div>
    {Object.entries(groups).map(([day, entries]) => <div className="tg-card glass2" key={day}>
      <div className="tg-card-head"><span className="serif">{Number(day.slice(5, 7))}/{Number(day.slice(8))}</span><span className="tg-card-meta">{entries.length} 笔</span></div>
      {entries.map(item => <div key={item.id}>
        <button className="shop-ledger-row" aria-expanded={selected === item.id} onClick={() => setSelected(selected === item.id ? '' : item.id)}><span className="shop-ledger-category">{item.category}</span><span className="shop-ledger-note">{item.note || types[item.type]}</span><span className={`shop-ledger-amount ${item.type}`}>{item.type === 'expense' ? '−' : '+'}{money(item.amountCents)}</span></button>
        {selected === item.id && <div className="shop-ledger-detail"><p>{item.note || '没有备注'}</p><small>{types[item.type]} · {item.date} · {item.by === 'ayan' ? '晏白' : '婉莹'}记下的</small>
          <div className="tg-actions">{item.orderId ? <button className="tg-btn ghost" onClick={() => openShopping?.({ orderId: item.orderId })}>查看关联购物</button> : <><button className="tg-btn ghost" disabled={saving} onClick={() => begin(item.type, item)}>编辑</button><button className="tg-btn danger" disabled={saving} onClick={async () => { if (confirm('删掉这笔记录？余额也会相应更新。') && await post('ledger', { op: 'remove', id: item.id })) setSelected('') }}>删除</button></>}</div>
        </div>}
      </div>)}
    </div>)}
  </div>
}
