'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { navigationRoute } = require('./shopping-browser-worker.cjs');
async function mock(url, options = {}) {
  let result;
  await navigationRoute({
    request: () => ({ url: () => url, isNavigationRequest: () => true, method: () => 'GET', frame: () => { throw Error('Frame not created'); } }),
    abort: async () => { result = 'abort'; if (options.closed) throw Error('Target closed'); },
    continue: async () => { result = 'continue'; if (options.closed) throw Error('Target closed'); },
    fulfill: async response => { result = response; }
  });
  return result;
}
(async () => {
  assert.equal(await mock('https://cart.jd.com/cart_index'), 'continue');
  assert.equal(await mock('https://example.com/'), 'abort');
  assert.equal(await mock('https://127.0.0.1/'), 'abort');
  assert.equal(await mock('https://jd.com.evil.test/'), 'abort');
  assert.equal(await mock('https://sso.jd.hk/other'), 'abort');
  const upgraded = await mock('http://passport.jd.com/relay/loginRelay?value=%2F%26');
  assert.equal(upgraded.status, 307);
  assert.equal(upgraded.headers.location, 'https://passport.jd.com/relay/loginRelay?value=%2F%26');
  await mock('https://cart.jd.com/cart_index', { closed: true });
  const browser = await chromium.launch({ channel: 'chromium', headless: true, chromiumSandbox: false });
  try {
    const context = await browser.newContext();
    let missingFrames = 0, fulfilled = 0;
    // All continued requests become local fixtures; no request reaches JD.
    await context.route('**/*', async route => {
      if (route.request().isNavigationRequest()) {
        try { route.request().frame(); } catch { missingFrames++; }
      }
      await navigationRoute({
        request: () => route.request(), abort: () => route.abort(), fulfill: response => route.fulfill(response),
        continue: () => { fulfilled++; return route.fulfill({ contentType: 'text/html', body: '<a target="_blank" href="https://cart.jd.com/cart_index">cart</a><p>fixture cart</p>' }); }
      });
    });
    const page = await context.newPage();
    await page.goto('https://www.jd.com/');
    for (let i = 0; i < 5; i++) {
      const popupPromise = page.waitForEvent('popup');
      await page.getByText('cart', { exact: true }).click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(await popup.locator('p').textContent(), 'fixture cart');
      await popup.close();
    }
    assert.equal(missingFrames, 5, 'Reproduce initial popup requests without frames');
    assert.equal(fulfilled, 6);
    const blockedPromise = page.waitForEvent('popup');
    await page.evaluate(() => window.open('https://example.com/'));
    const blocked = await blockedPromise;
    await blocked.waitForLoadState().catch(() => {});
    assert.equal(fulfilled, 6, 'External popup must not reach fixture/network');
    assert.equal(browser.isConnected(), true);
    await context.close();
    console.log('PASS: 5 real frameless popup navigations, external/private denial, HTTPS upgrade, closed-route handling; no external requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
