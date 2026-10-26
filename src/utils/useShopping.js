import { useCallback, useEffect, useRef, useState } from 'react'

export const shoppingDay = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
export const money = cents => `¥${((cents || 0) / 100).toFixed(2)}`
export const shoppingStates = { saved: '心愿', browsing: '挑选中', cart: '已加购', checkout: '核对订单', payment_pending: '待付款', paid: '已付款', failed: '未完成', cancelled: '已取消', refunded: '已退款' }
export function useShopping() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const seq = useRef(0), mounted = useRef(true), pending = useRef(false)
  const load = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    try {
      const r = await fetch('/api/shopping', { cache: 'no-store' })
      if (!r.ok) throw Error('记录暂时没取回来，稍后再试试。')
      const d = await r.json()
      if (!Array.isArray(d.entries) || !Array.isArray(d.orders)) throw Error('记录暂时没取回来，稍后再试试。')
      if (mounted.current && seq.current === id) { setData(d); setError('') }
    } catch (e) { if (mounted.current && seq.current === id) setError(e.message) }
    finally { if (mounted.current && seq.current === id) setLoading(false) }
  }, [])
  useEffect(() => {
    mounted.current = true; load()
    const resume = () => { if (!document.hidden && !pending.current) load() }
    const stream = new EventSource('/api/stream')
    let refresh
    stream.addEventListener('u', event => {
      try { if (JSON.parse(event.data).type === 'shopping_changed' && !document.hidden) { clearTimeout(refresh); refresh = setTimeout(resume, 120) } } catch {}
    })
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume)
    return () => { mounted.current = false; seq.current++; clearTimeout(refresh); stream.close(); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume) }
  }, [load])
  const post = async (path, body) => {
    if (pending.current) return null
    pending.current = true; setSaving(true); setError('')
    try {
      const r = await fetch('/api/shopping/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: 'wanying', ...body }) })
      const d = await r.json()
      if (!r.ok || !d.ok) throw Error(d.error || '没能保存，请保留内容后重试。')
      if (mounted.current) await load()
      return d
    } catch (e) { if (mounted.current) setError(e.message || '没能保存，请保留内容后重试。'); return null }
    finally { pending.current = false; if (mounted.current) setSaving(false) }
  }
  return { data, error, loading, saving, load, post }
}
