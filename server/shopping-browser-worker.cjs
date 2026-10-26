'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const PROFILE = process.env.SHOPPING_PROFILE || '/var/lib/ayan-shopping/profile';
const PORT = Number(process.env.SHOPPING_BROWSER_PORT || 3025);
const HOSTS = ['jd.com', '360buy.com'];
let context, page, launch, busy = false, error = '', confirmed = false, lastAt = null, loginEvidence = null;
const attempts = new Map();
function fault(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function allowed(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && HOSTS.some(host => u.hostname === host || u.hostname.endsWith('.' + host)); } catch { return false; } }
function sku(value) { const s = String(value || ''); if (!/^\d{4,20}$/.test(s)) fault('请选择有效的京东商品'); return s; }
function safeUrl(value) { try { const u = new URL(value); return u.origin + u.pathname; } catch { return ''; } }
async function ensure() {
  if (context && page && !page.isClosed()) return;
  if (launch) return launch;
  launch = (async () => {
    fs.mkdirSync(PROFILE, { recursive: true, mode: 0o700 });
    context = await chromium.launchPersistentContext(PROFILE, { channel: 'chromium', headless: process.env.SHOPPING_HEADFUL !== '1', chromiumSandbox: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1280, height: 900 }, acceptDownloads: false, timeout: 45000 });
    page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(10000);
    context.on('page', async extra => { if (extra !== page) await extra.close().catch(() => {}); });
    await context.route('**/*', route => {
      const req = route.request(); let u; try { u = new URL(req.url()); } catch { return route.abort(); }
      if (/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1\]?)/i.test(u.hostname) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(u.hostname)) return route.abort();
      if (req.isNavigationRequest() && req.frame() === page.mainFrame() && !allowed(req.url())) return route.abort();
      return route.continue();
    });
    error = '';
  })();
  try { await launch; } finally { launch = null; }
}
function hasSession(names) { return names.includes('thor') && names.includes('pin') || names.includes('pt_key') && names.includes('pt_pin'); }
async function sessionPresent() { if (!context) return false; return hasSession((await context.cookies('https://www.jd.com')).map(c => c.name)); }
function confirmedLogin(e) { return !e.redirected && !e.loginPrompt && !e.rateLimited && (e.nickname || e.logout); }
async function state() {
  const running = !!context && !!page && !page.isClosed();
  const loginPage = running && (/\b(?:passport|safe|aq)\.jd\.com\b/.test(page.url()) || await page.locator('.qrcode-img,.qrcode-main,[class*="qrcode"] img').first().isVisible().catch(() => false));
  return { available: true, running, busy, loginPage, login: running ? confirmed ? 'confirmed' : await sessionPresent() ? 'unverified' : 'needed' : 'needed', loginEvidence, title: running ? (await page.title().catch(() => '')).slice(0, 150) : '', url: running ? safeUrl(page.url()) : '', lastAt, error, headless: process.env.SHOPPING_HEADFUL !== '1', paymentsEnabled: false };
}
async function go(url) { if (!allowed(url)) fault('这里只打开京东购物页面'); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(1000); }
async function captureScreen(target, browserContext, options = {}) {
  const masks = await target.evaluateHandle(() => [...document.querySelectorAll('input[type="password"],input[autocomplete="one-time-code"],#ttbar-login,.user-info')].map(node => {
    const value = node.style.getPropertyValue('visibility'), priority = node.style.getPropertyPriority('visibility');
    node.style.setProperty('visibility', 'hidden', 'important'); return { node, value, priority };
  }));
  let cdp;
  try {
    cdp = await browserContext.newCDPSession(target);
    const result = await cdp.send('Page.captureScreenshot', { format: options.format || 'jpeg', ...(options.format === 'png' ? {} : { quality: 70 }), fromSurface: true, captureBeyondViewport: false, ...(options.clip ? { clip: { ...options.clip, scale: 1 } } : {}) });
    return Buffer.from(result.data, 'base64');
  } finally {
    await cdp?.detach().catch(() => {});
    await target.evaluate(items => { for (const { node, value, priority } of items) { if (value) node.style.setProperty('visibility', value, priority); else node.style.removeProperty('visibility'); } }, masks).catch(() => {});
    await masks.dispose();
  }
}
async function screenshot() {
  if (!context || !page || page.isClosed()) fault('先打开京东浏览器', 409);
  return captureScreen(page, context);
}
async function checkAccount() {
  await go('https://cart.jd.com/cart_index');
  for (let i = 0; i < 16; i++) {
    const session = await sessionPresent();
    const signals = await page.evaluate(hasCookie => {
      const visible = node => { const r = node.getBoundingClientRect(), s = getComputedStyle(node); return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 240 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const text = node => (node.textContent || '').replace(/\s+/g, ' ').trim();
      const controls = [...document.querySelectorAll('a,button')].filter(visible);
      const loginPrompt = controls.some(node => /^(?:你好，?\s*请登录|请登录|登录)$/.test(text(node)));
      const logout = controls.some(node => /^(?:退出登录|安全退出|退出)$/.test(text(node)));
      const known = [...document.querySelectorAll('#ttbar-login .nickname,#ttbar-login .link-user,#loginbar .nickname')].some(node => visible(node) && text(node) && !/登录|注册/.test(text(node)));
      const generic = hasCookie && [...document.querySelectorAll('[class*="nickname"],[class*="userName"],[class*="username"],[class*="user-name"]')].some(node => visible(node) && text(node).length > 0 && text(node).length < 80 && !/登录|注册|我的京东|购物车|帮助中心/.test(text(node)));
      const rateLimited = /操作太频繁|访问过于频繁|访问频繁/.test(document.body.innerText || '');
      return { loginPrompt, logout, nickname: !!(known || generic), rateLimited };
    }, session);
    loginEvidence = { session, ...signals, redirected: /passport\.jd\.com/.test(page.url()) };
    if (loginEvidence.redirected || signals.loginPrompt || signals.nickname || signals.logout || signals.rateLimited) break;
    await page.waitForTimeout(500);
  }
  confirmed = confirmedLogin(loginEvidence);
  if (loginEvidence.rateLimited) error = '京东提示访问频繁，请先暂停，稍后手动重试，不要连续扫码或刷新。';
  return confirmed;
}
async function products() {
  return page.locator('li.gl-item').evaluateAll(cards => cards.slice(0, 24).map(card => {
    const a = [...card.querySelectorAll('a[href]')].find(a => /item\.jd\.com\/\d+\.html/.test(a.href));
    const skuId = a?.href.match(/item\.jd\.com\/(\d+)\.html/)?.[1];
    const title = (card.querySelector('.p-name em')?.textContent || a?.title || a?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const price = (card.querySelector('.p-price i')?.textContent || '').trim();
    return skuId && title ? { skuId, title, url: 'https://item.jd.com/' + skuId + '.html', ...(/^\d+(?:\.\d{1,2})?$/.test(price) ? { price } : {}) } : null;
  }).filter(Boolean)).catch(() => []);
}
async function action(b) {
  const name = String(b.action || '');
  if (!['login', 'refresh', 'check', 'search', 'open', 'cart', 'add', 'loginClick', 'loginCode', 'close'].includes(name)) fault('不支持这个浏览器操作');
  if (busy) fault('他正在操作这一页，等一下再试', 409);
  if (name === 'close') { if (context) await context.close(); context = null; page = null; confirmed = false; return { ok: true, state: await state() }; }
  if (name === 'add') {
    if (!/^[a-zA-Z0-9-]{16,100}$/.test(String(b.clientId || ''))) fault('加购需要独立操作编号');
    if (attempts.has(b.clientId)) fault('这次加购已经尝试过，请先查看购物车再决定是否再次添加', 409);
  }
  busy = true; error = '';
  try {
    await ensure(); let result = {}, added = false;
    if (name === 'login') { confirmed = false; loginEvidence = null; await go('https://passport.jd.com/new/login.aspx'); }
    else if (name === 'refresh') { await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); }
    else if (name === 'cart' || name === 'check') { if (!await checkAccount()) result.message = error || '还未确认登录，请扫码后在京东 App 确认，再点“检查登录”。'; }
    else if (name === 'search') { const q = String(b.query || '').trim().slice(0, 100); if (!q) fault('先写下想找的东西'); await go('https://search.jd.com/Search?keyword=' + encodeURIComponent(q)); result.products = await products(); }
    else if (name === 'open') await go('https://item.jd.com/' + sku(b.skuId) + '.html');
    else if (name === 'add') {
      const id = sku(b.skuId);
      if (!await checkAccount()) fault(error || '先扫码登录，并在购物车确认登录状态', loginEvidence?.rateLimited ? 429 : 409);
      await go('https://item.jd.com/' + id + '.html');
      const shown = page.url().match(/item\.jd\.com\/(\d+)\.html/)?.[1];
      if (shown !== id) fault('商品页已跳转，先核对规格后再加购', 409);
      const button = page.getByText('加入购物车', { exact: true }).first();
      await button.waitFor({ state: 'visible' });
      attempts.set(b.clientId, Date.now()); if (attempts.size > 300) attempts.delete(attempts.keys().next().value);
      await button.click();
      await page.getByText(/(?:商品已成功加入购物车|已成功加入购物车|加入购物车成功)/).first().waitFor({ timeout: 12000 }).catch(() => {});
      added = /商品已成功加入购物车|已成功加入购物车|加入购物车成功/.test(await page.locator('body').innerText());
      result.added = added;
      if (!added) result.message = '这次没有看到加购成功提示，请先查看购物车，不要连续重试。';
    } else if (name === 'loginClick' || name === 'loginCode') {
      if (!/^(?:passport|safe|aq)\.jd\.com$/.test(new URL(page.url()).hostname)) fault('手动验证只在京东登录页面开放', 403);
      if (name === 'loginClick') {
        const x = Number(b.x), y = Number(b.y); if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1280 || y < 0 || y > 900) fault('请点登录画面内的位置');
        await page.mouse.click(x, y);
      } else { const code = String(b.code || ''); if (!/^\d{4,8}$/.test(code)) fault('只输入京东发来的数字验证码'); await page.keyboard.type(code, { delay: 80 }); }
    }
    lastAt = new Date().toISOString();
    return { ok: true, ...result, state: { ...await state(), busy: false } };
  } catch (e) { error = e.status ? e.message : /timeout/i.test(e.message) ? '京东页面暂时没有加载完成，可以刷新或稍后重试。' : '浏览器操作暂未完成，请查看画面后再试。'; const out = new Error(error); out.status = e.status || 502; throw out; }
  finally { busy = false; }
}
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/state') return json(res, 200, await state());
    if (req.method === 'GET' && req.url === '/screen') { const image = await screenshot(); res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }); return res.end(image); }
    if (req.method === 'GET' && req.url === '/qr') {
      if (!page || !/\bpassport\.jd\.com\b/.test(page.url())) fault('登录二维码尚未准备好', 409);
      const canvasIndex = await page.locator('canvas').evaluateAll(elements => elements.findIndex(element => { const r=element.getBoundingClientRect(); return r.width>=100 && r.height>=100 && Math.abs(r.width-r.height)<8; }));
      let qr;
      if (canvasIndex >= 0) qr = page.locator('canvas').nth(canvasIndex);
      else {
        const index = await page.locator('img').evaluateAll(images => images.findIndex(image => { const r=image.getBoundingClientRect(); return r.width>=100 && r.height>=100 && Math.abs(r.width-r.height)<8 && /qr/i.test(image.className+' '+image.parentElement.className+' '+image.src); }));
        if (index < 0) fault('这一页没有二维码，请查看操作画面', 409);
        qr = page.locator('img').nth(index);
      }
      await qr.scrollIntoViewIfNeeded(); const clip = await qr.boundingBox();
      if (!clip) fault('二维码还未显示，请刷新画面', 409);
      const bytes = await captureScreen(page, context, { format: 'png', clip }); res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); return res.end(bytes);
    }
    if (req.method === 'POST' && req.url === '/action') {
      let content = ''; for await (const chunk of req) { content += chunk; if (content.length > 8000) fault('请求太长', 413); }
      let body; try { body = JSON.parse(content); } catch { fault('请求格式不正确'); }
      return json(res, 200, await action(body));
    }
    json(res, 404, { error: '不存在这个操作' });
  } catch (e) { json(res, e.status || 500, { error: e.status ? e.message : '浏览器暂时不可用' }); }
});
if (require.main === module) server.listen(PORT, '127.0.0.1');
process.on('SIGTERM', async () => { await context?.close().catch(() => {}); process.exit(0); });
module.exports = { allowed, sku, hasSession, confirmedLogin, captureScreen };
