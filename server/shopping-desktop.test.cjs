const assert = require('node:assert/strict'), http = require('http'), net = require('net'), express = require('express');
const { WebSocket } = require('ws'), { register, attach, owner } = require('./shopping-browser-desktop.cjs');
const cookie = 'ayan_device=owner-fixture', origin = 'https://entangledforever.com', basePath = '/api/shopping/browser';
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', r));
async function main() {
 assert(!owner({ headers: {} })); assert(owner({ headers: { cookie } })); assert(!owner({ headers: { cookie, authorization: 'Bearer fixture' } })); assert(!owner({ headers: { cookie, origin: 'https://elsewhere.test' } }));
 let active = false, actions = [];
 const app = express(); app.use(express.json());
 app.use(basePath, (req, res, next) => req.headers.cookie === cookie || req.headers.authorization === 'Bearer fixture' ? next() : res.sendStatus(401));
 register(app, { getState: async () => ({ manualActive: active, running: true, headless: false }), action: async b => { actions.push(b.action); active = b.action === 'desktopBegin'; return { ok: true }; } });
 const server = http.createServer(app); await listen(server); const base = 'http://127.0.0.1:' + server.address().port;
 const vnc = net.createServer(socket => { socket.write('RFB-FIXTURE'); socket.on('data', data => socket.write(data)); }); await listen(vnc);
 const wss = attach(server, { authUrl: base + basePath + '/desktop-auth', vncPort: vnc.address().port, recheckMs: 80 });
 const post = action => fetch(base + basePath + '/desktop-control', { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
 const url = base.replace('http:', 'ws:') + basePath + '/desktop-ws';
 const rejected = headers => new Promise((resolve, reject) => { const ws = new WebSocket(url, { headers }); ws.once('unexpected-response', (req, res) => { res.resume(); req.destroy(); resolve(res.statusCode); }); ws.once('open', () => { ws.close(); reject(Error('unauthorized connection accepted')); }); ws.once('error', () => {}); });
 try {
  for (const endpoint of ['/desktop', '/desktop.js', '/desktop.css', '/desktop-auth', '/desktop-assets/core/rfb.js']) assert.equal((await fetch(base + basePath + endpoint)).status, 401);
  assert.equal((await fetch(base + basePath + '/desktop', { headers: { authorization: 'Bearer fixture' } })).status, 403);
  const page = await fetch(base + basePath + '/desktop', { headers: { cookie } }); assert.equal(page.status, 200); assert.equal(page.headers.get('cache-control'), 'no-store'); assert(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.equal(await rejected({ origin }), 403); assert.equal(await rejected({ cookie, origin: 'https://elsewhere.test' }), 403); assert.equal(await rejected({ cookie, origin }), 401);
  assert.equal((await post('begin')).status, 200); assert.deepEqual(actions, ['desktopBegin']);
  const ws = new WebSocket(url, { headers: { cookie, origin } }); const greeting = await new Promise((resolve, reject) => { ws.once('message', data => resolve(data.toString())); ws.once('error', reject); }); assert.equal(greeting, 'RFB-FIXTURE');
  const echo = new Promise(resolve => ws.once('message', data => resolve(data.toString()))); ws.send(Buffer.from('human-pointer-fixture')); assert.equal(await echo, 'human-pointer-fixture');
  assert.equal(await rejected({ cookie, origin }), 409);
  const closed = new Promise(resolve => ws.once('close', code => resolve(code))); assert.equal((await post('end')).status, 200); assert.equal(await closed, 1008);
  console.log('PASS owner cookie/origin checks, assistant bearer rejected, protected/no-store desktop and assets, websocket auth and single owner, binary mouse/keyboard transport, end revokes existing connection; all local fixtures');
 } finally { for (const ws of wss.clients) ws.terminate(); wss.close(); await new Promise(r => server.close(r)); await new Promise(r => vnc.close(r)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
