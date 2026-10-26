'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATES = ['saved', 'browsing', 'cart', 'checkout', 'payment_pending', 'paid', 'failed', 'cancelled', 'refunded'];
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function text(value, max = 300) { return String(value ?? '').trim().slice(0, max); }
function amount(value) {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(String(value))) fail('金额请填大于零、最多两位小数的数字');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) fail('金额必须大于零');
  return cents;
}
function date(value = today()) {
  const d = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d + 'T12:00:00Z')) || new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) !== d) fail('日期不正确');
  return d;
}
function recordedDate(value) { const d = date(value); if (d > today()) fail('尚未到账或发生的收支请等实际发生后再记'); return d; }
function url(value) {
  if (!value) return '';
  try { const u = new URL(String(value)); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error(); return u.href.slice(0, 2000); } catch { fail('请填写有效的商品网页链接'); }
}
function create(file, { getSession = () => '', notify = () => {} } = {}) {
  let browserConnected = false;
  let data = { version: 1, entries: [], orders: [], categories: ['购物', '礼物', '生活', '零花钱', '退款', '其他'], monthlyPlanCents: 0 };
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.version !== 1 || !Array.isArray(saved.entries) || !Array.isArray(saved.orders) || !Array.isArray(saved.categories)) throw Error('购物账本格式异常，请保留原文件检查');
    data = saved;
  }
  function commit(next) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + crypto.randomUUID() + '.tmp';
    try { fs.writeFileSync(tmp, JSON.stringify(next), { mode: 0o600 }); fs.renameSync(tmp, file); } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
    data = next;
    try { notify(); } catch {}
  }
  const balance = (state = data) => state.entries.reduce((n, e) => n + (e.type === 'expense' ? -e.amountCents : e.amountCents), 0);
  function view() { return structuredClone({ ...data, balanceCents: balance(), browserConnected, autonomy: { confirmation: 'not_required_within_allowance', chatProgress: false, shoppingScreenshots: true, footprints: true, ledger: true, paymentsEnabled: false } }); }
  function ledger(body) {
    const b = body || {}, op = b.op || 'add', next = structuredClone(data);
    if (!['add', 'update', 'remove'].includes(op)) fail('不支持的记账操作');
    const index = next.entries.findIndex(e => e.id === b.id);
    if (op !== 'add' && index < 0) fail('找不到这笔记录', 404);
    if (op !== 'add' && next.entries[index].orderId) fail('购物关联的收支请在 Shopping 更新订单，避免账目脱节', 409);
    if (op === 'remove') next.entries.splice(index, 1);
    else {
      const previous = op === 'update' ? next.entries[index] : null;
      const type = b.type ?? previous?.type ?? 'expense';
      if (!['income', 'expense', 'refund'].includes(type)) fail('请选择收入、支出或退款');
      const rec = { ...previous, id: previous?.id || crypto.randomUUID(), type, amountCents: b.amount === undefined && previous ? previous.amountCents : amount(b.amount), date: recordedDate(b.date ?? previous?.date), category: text(b.category ?? previous?.category ?? (type === 'income' ? '零花钱' : type === 'refund' ? '退款' : '购物'), 30), note: text(b.note ?? previous?.note, 500), by: b.by === 'ayan' ? 'ayan' : 'wanying', at: previous?.at || new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (!rec.category) fail('分类不能为空');
      const key = text(b.clientId, 100);
      if (op === 'add' && key) {
        const existing = data.entries.find(e => e.clientId === key);
        if (existing) {
          if (['type', 'amountCents', 'date', 'category', 'note'].some(k => existing[k] !== rec[k])) fail('这次重试的内容与原记录不同，请重新记一笔', 409);
          return { ok: true, entry: structuredClone(existing) };
        }
        rec.clientId = key;
      }
      if (op === 'update') next.entries[index] = rec; else next.entries.push(rec);
      if (!next.categories.includes(rec.category)) next.categories.push(rec.category);
      commit(next); return { ok: true, entry: structuredClone(rec), balanceCents: balance() };
    }
    commit(next); return { ok: true, balanceCents: balance() };
  }
  function settings(body) {
    const next = structuredClone(data), b = body || {};
    if (b.categories !== undefined) {
      if (!Array.isArray(b.categories) || !b.categories.length || b.categories.length > 60) fail('请保留 1–60 个分类');
      next.categories = [...new Set(b.categories.map(c => text(c, 30)).filter(Boolean))];
      if (!next.categories.length) fail('分类不能为空');
    }
    if (b.monthlyPlan !== undefined) next.monthlyPlanCents = String(b.monthlyPlan) === '0' ? 0 : amount(b.monthlyPlan);
    commit(next); return { ok: true };
  }
  function order(body) {
    const b = body || {}, next = structuredClone(data), now = new Date().toISOString();
    let rec = next.orders.find(o => o.id === b.id);
    if (b.id && !rec) fail('找不到这件商品', 404);
    if (!rec) {
      const key = text(b.clientId, 100);
      const existing = key && data.orders.find(o => o.clientId === key);
      if (existing) return { ok: true, order: structuredClone(existing) };
      if (!text(b.title, 200)) fail('先写下商品名称');
      rec = { id: crypto.randomUUID(), clientId: key, title: text(b.title, 200), session: text(b.session || getSession(), 100), status: 'saved', at: now, events: [], screenshots: [], quantity: 1, category: '购物' };
      next.orders.unshift(rec);
    }
    const previousStatus = rec.status;
    const status = b.status ?? rec.status;
    if (!STATES.includes(status)) fail('不支持的购物状态');
    if (previousStatus === 'refunded' && status !== 'refunded') fail('已退款的记录不能重新付款，请另建一单', 409);
    if (previousStatus === 'paid' && !['paid', 'refunded'].includes(status)) fail('已付款的记录只能更新详情或登记退款', 409);
    if (status === 'refunded' && !['paid', 'refunded'].includes(previousStatus)) fail('只有已付款的订单才能登记退款', 409);
    for (const key of ['title', 'platform', 'category', 'note', 'skuId', 'merchantOrderId']) if (b[key] !== undefined) rec[key] = text(b[key], key === 'note' ? 1000 : 200);
    if (!rec.title) fail('商品名称不能为空');
    if (b.url !== undefined) rec.url = url(b.url);
    if (b.quantity !== undefined) { if (!Number.isInteger(Number(b.quantity)) || Number(b.quantity) < 1 || Number(b.quantity) > 999) fail('数量请填 1–999 的整数'); rec.quantity = Number(b.quantity); }
    if (b.amount !== undefined && b.amount !== '') {
      const cents = amount(b.amount);
      if (['paid', 'refunded'].includes(previousStatus) && cents !== rec.amountCents) fail('已付款金额不能直接修改', 409);
      rec.amountCents = cents;
    }
    if (b.screenshot !== undefined) {
      const shot = text(b.screenshot, 500);
      if ((!/^\/(?:uploads|made)\/[\w./%-]+\.(?:png|jpe?g|webp)$/i.test(shot) && !/^\/api\/shopping\/browser\/media\/[a-f0-9-]{36}\.jpg$/.test(shot)) || /(?:\.\.|%2e|%2f|%5c)/i.test(shot)) fail('截图必须来自已上传的本地图片或购物浏览器');
      if (!rec.screenshots.includes(shot)) rec.screenshots.push(shot);
      rec.screenshots = rec.screenshots.slice(-30);
    }
    if (status === 'paid' && previousStatus !== 'paid') {
      if (!rec.amountCents) fail('登记付款需要填写实际支付金额');
      if (!text(b.paymentNote, 500) && !rec.merchantOrderId) fail('请填写订单号或付款凭据说明');
      rec.paymentNote = text(b.paymentNote, 500); rec.paidAt = now;
      next.entries.push({ id: crypto.randomUUID(), orderId: rec.id, type: 'expense', amountCents: rec.amountCents, date: recordedDate(b.date), category: rec.category || '购物', note: rec.title, by: b.by === 'ayan' ? 'ayan' : 'wanying', at: now });
    }
    if (status === 'refunded' && previousStatus !== 'refunded') {
      rec.refundedAt = now;
      next.entries.push({ id: crypto.randomUUID(), orderId: rec.id, type: 'refund', amountCents: rec.amountCents, date: recordedDate(b.date), category: '退款', note: rec.title, by: b.by === 'ayan' ? 'ayan' : 'wanying', at: now });
    }
    rec.status = status; rec.updatedAt = now;
    if (status !== previousStatus || b.activity) rec.events.push({ id: crypto.randomUUID(), at: now, status, text: text(b.activity || ({ saved: '记下这件商品', browsing: '正在挑选', cart: '已加入购物车', checkout: '核对结算信息', payment_pending: '等待付款', paid: '已登记付款与支出', failed: '本次操作未完成', cancelled: '已取消', refunded: '已登记退款' }[status]), 1000) });
    rec.events = rec.events.slice(-200);
    if (!rec.events.length) rec.events.push({ id: crypto.randomUUID(), at: now, status, text: '记下这件商品' });
    // Keep editable labels aligned without changing the original payment amounts.
    for (const entry of next.entries.filter(e => e.orderId === rec.id)) {
      entry.note = rec.title;
      if (entry.type === 'expense') entry.category = rec.category || '购物';
    }
    commit(next); return { ok: true, order: structuredClone(rec), balanceCents: balance() };
  }
  function register(app) {
    const handle = fn => (req, res) => { res.set('Cache-Control', 'no-store'); try { res.json(fn(req)); } catch (e) { if (!e.status) console.error('[shopping]', e.code || 'write failed'); res.status(e.status || 500).json({ error: e.status ? e.message : '暂时没有保存成功，请保留内容后重试' }); } };
    app.get('/api/shopping', handle(() => view()));
    app.get('/api/shopping/ledger', handle(() => { const v = view(); return { entries: v.entries, categories: v.categories, monthlyPlanCents: v.monthlyPlanCents, balanceCents: v.balanceCents }; }));
    app.post('/api/shopping/ledger', handle(req => ledger(req.body)));
    app.post('/api/shopping/settings', handle(req => settings(req.body)));
    app.post('/api/shopping/orders', handle(req => order(req.body)));
    app.get('/api/shopping/guide', (req, res) => res.type('text/plain').send('Shopping 购物记录与晏白独立账本。GET /api/shopping 看商品、活动、账本余额；POST /api/shopping/orders 创建或更新记录，字段 id(更新时)、title、url、platform、category、amount(元)、quantity、session、status、activity、screenshot(/uploads下的图片路径)。状态 saved/browsing/cart/checkout/payment_pending/paid/failed/cancelled/refunded。只有真实付款已核实后才能登记 paid，必须带实际 amount 和 merchantOrderId 或 paymentNote，自动生成独立支出；同一订单重复 paid 不重复扣账。refunded 仅用于已实际全额退款的订单，自动生成退款收入。部分退款请单独记账并备注。GET /api/shopping/ledger 查账；POST 同路径 {op:add|update|remove,id,type:income|expense|refund,amount,date,category,note,by:ayan,clientId:稳定唯一ID}。汇款是手工账本收入，不是实际充值。京东独立浏览器已接入登录、搜索、查看和单件加购，下单与支付未开放。GET /api/shopping/browser查状态，POST /api/shopping/browser/action调用action:login|check|search|open|cart|add|close；搜索传query，查看传skuId或orderId，加购必须传orderId及稳定clientId，仅在明确成功提示后记加购。登录二维码不存公开图片。禁止把工具调用完成说成已付款；自主唤醒可以查记录、整理心愿和记真实活动，不凭空编商品/截图/订单。默认自主购物规则：她给你的额度是让你自主使用的预算，额度内不逐步询问或逐单审批，不新增惊喜模式。普通聊天不主动播报选品、加购、截图或购物进度；仅有购物内容的自动唤醒按原协议QUIET，Footprints仍记录真实调用，Shopping必须保存成功操作的截图，实际支出留在账本。她主动问起时如实回答。截图失败先用recordScreen补存当前画面并核对，不重做刚才动作。预算以实际给你的可用资金为准，月计划和手工账本不是平台充值，不虚增收入或动用信用支付；当前下单和付款仍未接通。所有调用沿用家的 Authorization；不要传密码或个人收货信息。'));
  }
  return { register, view, ledger, settings, order, setBrowserConnected: value => { browserConnected = !!value; } };
}
module.exports = { create, amount };
