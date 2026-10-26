'use strict';
const path = require('path'), net = require('net'), express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const BASE = '/api/shopping/browser';
const ORIGIN = 'https://entangledforever.com';
function owner(req, origin = ORIGIN) {
  return !req.headers.authorization && /(?:^|;\s*)ayan_device=[^;]+/.test(req.headers.cookie || '') && (!req.headers.origin || req.headers.origin === origin);
}
function register(app, { getState, action, assets = '/opt/ayan-shopping/node_modules/@novnc/novnc', origin = ORIGIN }) {
  const guarded = fn => async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff');
    if (!owner(req, origin)) return res.status(403).json({ error: '请在已连接的设备上亲自打开登录窗口' });
    try { await fn(req, res); } catch { res.status(503).json({ error: '登录窗口暂时没有连接，请稍后重新打开。' }); }
  };
  app.get(BASE + '/desktop', guarded((req, res) => {
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.sendFile(path.join(__dirname, 'shopping-browser-desktop.html'));
  }));
  for (const ext of ['js', 'css']) app.get(BASE + '/desktop.' + ext, guarded((req, res) => res.sendFile(path.join(__dirname, 'shopping-browser-desktop.' + ext))));
  const files = express.static(assets, { dotfiles: 'deny', index: false, redirect: false, setHeaders: response => response.setHeader('Cache-Control', 'no-store') });
  app.use(BASE + '/desktop-assets', guarded((req, res) => { if (!/^\/(?:core|vendor)\/.+\.js$/.test(req.path)) return res.sendStatus(404); files(req, res, () => res.sendStatus(404)); }));
  app.post(BASE + '/desktop-control', guarded(async (req, res) => {
    if (!['begin', 'end'].includes(req.body?.action)) return res.sendStatus(400);
    res.json(await action({ action: req.body.action === 'begin' ? 'desktopBegin' : 'desktopEnd' }));
  }));
  app.get(BASE + '/desktop-auth', guarded(async (req, res) => {
    const state = await getState();
    if (!state.running || state.headless || !state.manualActive) return res.sendStatus(409);
    res.sendStatus(204);
  }));
}
function attach(server, { authorize, getState, vncPort = 5906, origin = ORIGIN, recheckMs = 15000 } = {}) {
  const checkDevice = authorize || require('./engine-access.js').authorized;
  const desktopState = getState || (async () => {
    const response = await fetch('http://127.0.0.1:3025/state', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw Error('Browser state unavailable');
    return response.json();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false });
  async function authorized(req) {
    try {
      if (!await checkDevice(req)) return false;
      const state = await desktopState();
      return !!state.running && !state.headless && !!state.manualActive;
    } catch { return false; }
  }
  const upgradeDesktop = async (req, socket, head) => {
    const reject = status => { socket.end('HTTP/1.1 ' + status + '\r\nConnection: close\r\nX-Ayan-Desktop-Route: owner\r\nContent-Length: 0\r\n\r\n'); };
    if (!owner(req, origin) || req.headers.origin !== origin) return reject('403 Forbidden');
    if (!await authorized(req)) return reject('401 Unauthorized');
    if (wss.clients.size) return reject('409 Conflict');
    if (socket.destroyed) return;
    wss.handleUpgrade(req, socket, head, ws => {
      const remote = net.connect({ host: '127.0.0.1', port: vncPort });
      const finish = () => { remote.destroy(); if (ws.readyState === WebSocket.OPEN) ws.close(); };
      remote.on('data', data => { if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 4 * 1024 * 1024) return finish(); ws.send(data, { binary: true }); });
      remote.on('error', finish); remote.on('close', finish);
      ws.on('message', data => { if (remote.writableLength > 4 * 1024 * 1024) return finish(); remote.write(data); });
      ws.on('error', finish); ws.on('close', () => { clearInterval(timer); remote.destroy(); });
      const timer = setInterval(async () => { if (!await authorized(req)) { ws.close(1008, '登录窗口已结束'); remote.destroy(); } }, recheckMs);
      timer.unref();
    });
  };
  // Existing server-bound ws listeners reject nonmatching paths before our async
  // authentication can finish. Route the desktop path exclusively, and preserve
  // the original listeners (including once wrappers) for every other upgrade.
  const previous = server.rawListeners('upgrade');
  for (const listener of previous) server.removeListener('upgrade', listener);
  server.on('upgrade', function (req, socket, head) {
    if (req.url === BASE + '/desktop-ws') {
      upgradeDesktop(req, socket, head).catch(() => socket.destroy());
      return;
    }
    for (const listener of previous) listener.call(this, req, socket, head);
  });
  return wss;
}
module.exports = { register, attach, owner };
