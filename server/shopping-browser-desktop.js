import RFB from './desktop-assets/core/rfb.js';
const status = document.getElementById('status'), screen = document.getElementById('screen'), retry = document.getElementById('retry');
let rfb, timer, connecting = false, ending = false;
async function control(action, keepalive = false) {
  const response = await fetch('/api/shopping/browser/desktop-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), keepalive, cache: 'no-store' });
  if (!response.ok) throw Error('登录窗口没有连接，请先确认这台设备已连接到家。');
  return response.json();
}
async function connect() {
  if (connecting) return;
  connecting = true; ending = false; retry.hidden = true;
  status.textContent = '正在连接你的购物浏览器…';
  try {
    clearInterval(timer); rfb?.disconnect();
    await control('begin');
    screen.replaceChildren();
    rfb = new RFB(screen, `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/shopping/browser/desktop-ws`);
    rfb.scaleViewport = true; rfb.resizeSession = false; rfb.clipViewport = false; rfb.viewOnly = false; rfb.focusOnClick = true;
    rfb.addEventListener('connect', () => { status.textContent = '已连接，可以直接操作。验证完成后点右上角返回。'; });
    rfb.addEventListener('disconnect', () => { clearInterval(timer); if (!ending) { status.textContent = '连接已断开。可以重新连接，浏览器里的登录仍会保留。'; retry.hidden = false; } });
    timer = setInterval(() => { if (!document.hidden) control('begin').catch(() => { rfb?.disconnect(); }); }, 30000);
  } catch (e) { status.textContent = e.message; retry.hidden = false; }
  finally { connecting = false; }
}
document.getElementById('finish').addEventListener('click', async () => {
  ending = true; clearInterval(timer); rfb?.disconnect();
  try { await control('end'); location.assign('/'); } catch (e) { status.textContent = e.message; ending = false; retry.hidden = false; }
});
document.getElementById('reconnect').addEventListener('click', connect);
document.addEventListener('visibilitychange', () => { if (!document.hidden && rfb) control('begin').catch(() => rfb?.disconnect()); });
window.addEventListener('pagehide', () => { ending = true; clearInterval(timer); rfb?.disconnect(); control('end', true).catch(() => {}); });
connect();
