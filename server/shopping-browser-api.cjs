'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
function create({ shopping, dir, getSession = () => '', notify = () => {}, workerUrl = 'http://127.0.0.1:3025' }) {
  const logFile = path.join(dir, 'shopping-browser-activities.json'), mediaDir = path.join(dir, 'shopping-media');
  let activities = [];
  if (fs.existsSync(logFile)) { activities = JSON.parse(fs.readFileSync(logFile, 'utf8')); if (!Array.isArray(activities)) throw Error('购物浏览器记录格式错误'); }
  function log(action, status, b, summary, screenshot = '') {
    if (['login', 'loginClick', 'loginCode', 'loginPassword', 'refresh', 'check', 'close'].includes(action)) return;
    const rec = { id: crypto.randomUUID(), action, status, session: String(b.session || getSession()).slice(0, 100), orderId: String(b.orderId || '').slice(0, 100), summary: summary.slice(0, 300), screenshot, at: new Date().toISOString() };
    const next = [rec, ...activities].slice(0, 1000), tmp = logFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next), { mode: 0o600 }); fs.renameSync(tmp, logFile); activities = next; notify();
    return rec;
  }
  async function request(endpoint, body) {
    let r;
    try { r = await fetch(workerUrl + endpoint, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(body ? 60000 : 15000) }); }
    catch { const e = new Error('购物浏览器暂时没有连接，可以稍后再试。'); e.status = 503; throw e; }
    if (!r.ok) { const d = await r.json().catch(() => ({})); const e = new Error(d.error || '这次浏览器操作没有完成'); e.status = r.status; throw e; }
    return r;
  }
  async function status() {
    try { const d = await (await request('/state')).json(); shopping.setBrowserConnected?.(true); return { ...d, activities: activities.slice(0, 60) }; }
    catch (e) { shopping.setBrowserConnected?.(false); return { available: false, running: false, login: 'needed', paymentsEnabled: false, error: e.message, activities: activities.slice(0, 60) }; }
  }
  async function capture(state) {
    if (!state?.running || state.loginPage || /\b(?:passport|safe|aq)\.jd\.com\b/.test(state.url || '')) return '';
    const bytes = Buffer.from(await (await request('/screen')).arrayBuffer());
    if (bytes.length > 3 * 1024 * 1024 || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw Error('浏览器截图未正确返回');
    fs.mkdirSync(mediaDir, { recursive: true, mode: 0o700 });
    const name = crypto.randomUUID() + '.jpg'; fs.writeFileSync(path.join(mediaDir, name), bytes, { mode: 0o600 });
    return '/api/shopping/browser/media/' + name;
  }
  async function action(b = {}) {
    const allowed = ['login', 'refresh', 'check', 'search', 'open', 'cart', 'add', 'recordScreen', 'loginClick', 'loginCode', 'loginPassword', 'close'];
    if (!allowed.includes(b.action)) { const e = new Error('不支持这个购物操作'); e.status = 400; throw e; }
    let record;
    if (b.orderId) record = shopping.view().orders.find(o => o.id === b.orderId);
    if (b.orderId && !record) { const e = new Error('找不到这条购物记录'); e.status = 404; throw e; }
    let skuId = b.skuId;
    if (record && ['open', 'add'].includes(b.action)) skuId = record.url?.match(/^https:\/\/item\.jd\.com\/(\d{4,20})\.html(?:[?#]|$)/)?.[1];
    if (['open', 'add'].includes(b.action) && !/^\d{4,20}$/.test(String(skuId || ''))) { const e = new Error('请选择带有有效京东链接的商品'); e.status = 400; throw e; }
    if (b.action === 'add' && (!record || ['cart', 'paid', 'refunded'].includes(record.status))) { const e = new Error(record ? '这条记录已经加购或购买，请先查看购物车。' : '先把商品记进 Shopping，再从商品记录加购。'); e.status = 409; throw e; }
    if (b.action === 'add' && record.quantity !== 1) { const e = new Error('当前仅支持单件加购，请先把数量设为一件。'); e.status = 409; throw e; }
    if (b.action === 'add') {
      const previous = activities.find(a => a.action === 'add' && a.orderId === record.id);
      if (previous && previous.status !== 'completed' && !activities.some(a => a.action === 'cart' && a.status === 'completed' && a.at > previous.at)) { const e = new Error('上次加购结果尚未确认，请先查看购物车，避免重复添加。'); e.status = 409; throw e; }
    }
    const payload = { action: b.action, ...(skuId ? { skuId } : {}), ...(b.action === 'search' ? { query: String(b.query || '').slice(0, 100) } : {}), ...(b.action === 'add' ? { clientId: String(b.clientId || '') } : {}), ...(b.action === 'loginClick' ? { x: b.x, y: b.y } : {}), ...(b.action === 'loginCode' ? { code: b.code } : {}), ...(b.action === 'loginPassword' ? { account: b.account, password: b.password } : {}) };
    let performed = false, screenshot = '';
    try {
      const response = b.action === 'recordScreen' ? { ok: true, state: await (await request('/state')).json() } : await (await request('/action', payload)).json();
      performed = true;
      if (['search', 'open', 'cart', 'add', 'recordScreen'].includes(b.action) && !response.state?.loginPage) {
        screenshot = await capture(response.state);
        if (!screenshot) throw Error('当前没有可归档的购物画面');
      }
      if (b.action === 'recordScreen' && !screenshot) { const e = new Error('登录二维码不归档，请完成登录后再留存购物截图'); e.status = 409; throw e; }
      const blockedByLogin = ['search', 'open', 'cart', 'add'].includes(b.action) && response.state?.loginPage;
      const summary = blockedByLogin ? '需要登录，当前购物步骤尚未完成' : b.action === 'search' ? '查找商品：' + payload.query : b.action === 'add' ? response.added ? '已看到加购成功提示' : '没有确认加购成功，请核对购物车' : b.action === 'cart' ? '查看购物车' : b.action === 'recordScreen' ? '留存当前购物截图' : '查看商品详情';
      const activity = log(b.action, blockedByLogin || b.action === 'add' && !response.added ? 'unconfirmed' : 'completed', b, summary, screenshot);
      if (record && ['open', 'add', 'recordScreen'].includes(b.action) && !['paid', 'refunded'].includes(record.status)) shopping.order({ id: record.id, status: b.action === 'add' && response.added ? 'cart' : b.action === 'add' ? 'failed' : b.action === 'open' && record.status === 'saved' ? 'browsing' : record.status, activity: summary, ...(screenshot ? { screenshot } : {}), by: 'ayan' });
      return { ...response, ...(activity ? { activity } : {}) };
    } catch (e) {
      const missingEvidence = performed && !screenshot && ['search', 'open', 'cart', 'add'].includes(b.action);
      const message = missingEvidence ? '这次操作已经发生，截图尚未保存；先留存当前截图并核对结果，不要重复刚才的操作。' : e.status ? e.message : '请查看浏览器画面';
      log(b.action, performed ? 'unconfirmed' : 'failed', b, message, screenshot);
      if (!e.status || missingEvidence) { e.status = 502; e.message = message; }
      throw e;
    }
  }
  function register(app) {
    const handle = fn => async (req, res) => { res.set('Cache-Control', 'no-store'); try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : '记录暂时没有保存，请保留当前画面后重试。' }); } };
    app.get('/api/shopping/browser', handle(status));
    app.post('/api/shopping/browser/action', handle(req => {
      if (['loginClick', 'loginCode', 'loginPassword'].includes(req.body?.action) && req.headers.authorization) { const e = new Error('登录验证请由你在 Shopping 页面亲自完成'); e.status = 403; throw e; }
      return action(req.body);
    }));
    app.get('/api/shopping/browser/qr', async (req, res) => { res.set('Cache-Control', 'no-store'); try { res.type('image/png').send(Buffer.from(await (await request('/qr')).arrayBuffer())); } catch (e) { res.status(e.status || 503).json({ error: e.message }); } });
    app.get('/api/shopping/browser/screen', async (req, res) => { res.set('Cache-Control', 'no-store'); try { res.type('image/jpeg').send(Buffer.from(await (await request('/screen')).arrayBuffer())); } catch (e) { res.status(e.status || 503).json({ error: e.message }); } });
    app.get('/api/shopping/browser/media/:name', (req, res) => {
      res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff');
      if (!/^[a-f0-9-]{36}\.jpg$/.test(req.params.name)) return res.sendStatus(404);
      const file = path.join(mediaDir, req.params.name); if (!fs.existsSync(file)) return res.sendStatus(404); res.type('image/jpeg').sendFile(file);
    });
  }
  return { register, action, status };
}
module.exports = { create };
