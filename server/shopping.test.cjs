const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { create } = require('./shopping.cjs');

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ayan-shopping-'));
  const file = path.join(dir, 'shopping.json');
  const book = create(file, { getSession: () => 'fixture-home' });
  const day = '2026-10-26';
  assert.equal(book.view().balanceCents, 0);
  const income = { amount: '500.00', type: 'income', category: '每月汇款', date: day, note: '十月', clientId: 'income-fixture' };
  book.ledger(income); book.ledger(income);
  assert.equal(book.view().entries.length, 1);
  assert.throws(() => book.ledger({ ...income, amount: '501' }), /重试/);
  for (const invalid of ['NaN', '-1', '0', '1.001', 'Infinity', '', '1e2']) assert.throws(() => book.ledger({ amount: invalid }));
  assert.throws(() => book.ledger({ amount: '1', date: '2026-02-30' }), /日期/);
  assert.throws(() => book.ledger({ amount: '1', date: '2099-01-01' }), /实际发生/);
  assert.equal(book.view().balanceCents, 50000);
  const wish = book.order({ title: '测试的茶杯', amount: '80.50', url: 'https://item.jd.com/123.html', clientId: 'order-fixture' }).order;
  assert.equal(wish.status, 'saved'); assert.equal(wish.session, 'fixture-home');
  assert.equal(book.order({ title: '测试的茶杯', amount: '80.50', clientId: 'order-fixture' }).order.id, wish.id);
  assert.throws(() => book.order({ id: wish.id, status: 'paid' }), /凭据/);
  assert.equal(book.view().balanceCents, 50000);
  assert.throws(() => book.order({ id: wish.id, url: 'javascript:alert(1)' }), /链接/);
  assert.throws(() => book.order({ id: wish.id, screenshot: '/uploads/../private.jpg' }), /截图/);
  book.order({ id: wish.id, status: 'cart', activity: '模拟加购', screenshot: '/uploads/fixture.png' });
  book.order({ id: wish.id, status: 'paid', merchantOrderId: 'fixture-order-123', by: 'ayan' });
  book.order({ id: wish.id, status: 'paid', merchantOrderId: 'fixture-order-123', by: 'ayan' });
  assert.equal(book.view().balanceCents, 41950);
  assert.equal(book.view().entries.filter(e => e.orderId === wish.id).length, 1);
  const linked = book.view().entries.find(e => e.orderId === wish.id);
  assert.throws(() => book.ledger({ op: 'remove', id: linked.id }), /关联/);
  assert.throws(() => book.order({ id: wish.id, amount: '1' }), /金额/);
  assert.throws(() => book.order({ id: wish.id, status: 'cancelled' }), /已付款/);
  book.order({ id: wish.id, status: 'refunded' }); book.order({ id: wish.id, status: 'refunded' });
  assert.equal(book.view().balanceCents, 50000);
  assert.equal(book.view().entries.filter(e => e.orderId === wish.id).length, 2);
  assert.throws(() => book.order({ id: wish.id, status: 'paid' }), /退款/);
  const manual = book.ledger({ amount: '20.45', type: 'expense', category: '自定义分类', date: day }).entry;
  book.ledger({ op: 'update', id: manual.id, amount: '21.10', category: '猫咪', note: '修改后的备注' });
  assert.equal(book.view().balanceCents, 47890);
  assert(book.view().categories.includes('猫咪'));
  book.ledger({ op: 'remove', id: manual.id });
  book.settings({ monthlyPlan: '600', categories: ['小礼物', '猫咪', '零花钱'] });
  assert.equal(book.view().monthlyPlanCents, 60000);
  assert.deepEqual(book.view().categories, ['小礼物', '猫咪', '零花钱']);
  assert.equal(create(file).view().balanceCents, 50000);
  const snapshot = book.view(); snapshot.entries.length = 0; assert.equal(book.view().entries.length, 3);
  const corrupt = path.join(dir, 'corrupt.json'); fs.writeFileSync(corrupt, '{broken'); assert.throws(() => create(corrupt));
  const invalid = path.join(dir, 'invalid.json'); fs.writeFileSync(invalid, '{}'); assert.throws(() => create(invalid));
  console.log('PASS cents, income/retry/conflict, invalid amount/date, atomic persistent records, order/ledger linkage, paid/refund idempotency, edits/categories/monthly plan, corrupt-file protection');

  const express = require('express'), app = express(); app.use(express.json());
  // Same authorization placement as production: registration happens after the existing access middleware.
  app.use('/api/shopping', (req, res, next) => req.headers.authorization === 'Bearer fixture' ? next() : res.status(401).json({ error: 'paired' })); book.register(app);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/shopping')).status, 401);
    const headers = { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' };
    const read = await fetch(base + '/api/shopping', { headers }); assert.equal(read.headers.get('cache-control'), 'no-store');
    assert.equal((await read.json()).browserConnected, false);
    assert.equal((await fetch(base + '/api/shopping/ledger', { method: 'POST', headers, body: JSON.stringify({ amount: '-5' }) })).status, 400);
    assert((await (await fetch(base + '/api/shopping/guide', { headers })).text()).includes('未接浏览器'));
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS API responses, auth middleware placement, no-store and honest shopping capability guide');
  const fixture = path.join(__dirname, 'backend-fixture');
  if (fs.existsSync(path.join(fixture, 'footprints.cjs'))) {
    const fp = require('./backend-fixture/footprints.cjs').create(path.join(dir, 'footprints.json'));
    const proc = new EventEmitter(); proc.stdout = new EventEmitter(); proc.stderr = new EventEmitter();
    fp.track(proc, { session: 'fixture-home', kind: 'wander' });
    const detail = 'Bash curl -X POST http://127.0.0.1:3000/api/shopping/orders -d \'{"id":"' + wish.id + '","status":"cart"}\'';
    proc.stderr.emit('data', '__AYAN_FOOTPRINT__' + JSON.stringify({ kind: 'activity', id: 'shopping-tool', detail, status: 'running' }) + '\n');
    proc.stderr.emit('data', '__AYAN_FOOTPRINT__' + JSON.stringify({ kind: 'activity', id: 'shopping-tool', detail, status: 'completed' }) + '\n');
    proc.stdout.emit('data', JSON.stringify({ result: '[QUIET]' })); proc.emit('close', 0, null);
    const rec = fp.list({ sessions: [{ id: 'fixture-home', title: '模拟家', messages: [] }] }).items[0];
    assert.equal(rec.status, 'quiet'); assert.equal(rec.activities.length, 1); assert.equal(rec.activities[0].status, 'completed'); assert(rec.activities[0].detail.includes('/api/shopping/orders'));
    console.log('PASS autonomous quiet wake keeps completed shopping invocation without posting chat');
  }
  // Only remove this test-owned temporary directory.
  assert(path.resolve(dir).startsWith(path.join(path.resolve(os.tmpdir()), 'ayan-shopping-'))); fs.rmSync(dir, { recursive: true });
}
run().catch(e => { console.error(e); process.exitCode = 1; });
