import RFB from './desktop-assets/core/rfb.js';
const status = document.getElementById('status'), screen = document.getElementById('screen'), retry = document.getElementById('retry');
const retryMessage = document.getElementById('retry-message');
let rfb, timer, connecting = false, ending = false;
async function control(action, keepalive = false) {
  const response = await fetch('/api/shopping/browser/desktop-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), keepalive, cache: 'no-store' });
  if (!response.ok) {
    const error = Error([401, 403].includes(response.status) ? '这台设备的连接授权未通过，请先在主页连接设备。' : '远程登录服务暂时没有响应，请稍后重新连接。');
    error.needsPairing = [401, 403].includes(response.status); throw error;
  }
  return response.json();
}
async function connect() {
  if (connecting) return;
  connecting = true; ending = false; retry.hidden = true;
  status.textContent = '正在连接你的购物浏览器…';
  retryMessage.textContent = '画面通道断开时，可先点“重新连接”，不必重复设备配对。';
  try {
    clearInterval(timer); rfb?.disconnect();
    await control('begin');
    screen.replaceChildren();
    rfb = new RFB(screen, `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/shopping/browser/desktop-ws`);
    rfb.scaleViewport = true; rfb.resizeSession = false; rfb.clipViewport = false; rfb.viewOnly = false; rfb.focusOnClick = true;
    rfb.addEventListener('connect', () => { status.textContent = '已连接，可以直接操作。验证完成后点右上角返回。'; });
    rfb.addEventListener('disconnect', () => { clearInterval(timer); if (!ending) { status.textContent = '设备连接已通过，但远程画面已断开。请点“重新连接”。'; retryMessage.textContent = '这不是京东登录结果，也不表示主页未配对。先重新连接画面，不用重新输入设备连接码。'; retry.hidden = false; } });
    timer = setInterval(() => { if (!document.hidden) control('begin').catch(() => { rfb?.disconnect(); }); }, 30000);
  } catch (e) { status.textContent = e.message; retryMessage.textContent = e.needsPairing ? '请打开主页完成设备连接，再回到此窗口。' : '暂时无法连接远程画面，可以稍后重试。'; retry.hidden = false; }
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
