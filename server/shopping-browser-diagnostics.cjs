'use strict';
function endpoint(value) {
  try {
    const u = new URL(value);
    if (!/(^|\.)(jd\.com|jd\.hk|360buy\.com|360buyimg\.com|jcloud\.com)$/.test(u.hostname)) return null;
    // Only a fixed operation label, never arbitrary URL paths or query values.
    return { host: u.hostname, operation: /cart/i.test(u.searchParams.get('functionId') || '') || /cart/i.test(u.hostname) ? 'cart' : 'other' };
  } catch { return null; }
}
function signals(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {}, codes = [];
  for (const obj of [body, body.data, body.result]) {
    if (!obj || typeof obj !== 'object') continue;
    for (const key of ['code', 'resultCode', 'errCode', 'errorCode', 'status']) {
      const v = obj[key];
      if ((typeof v === 'number' || typeof v === 'string') && /^-?\d{1,8}$/.test(String(v))) codes.push({ field: key, value: String(v) });
    }
    for (const key of ['message', 'msg', 'errMsg', 'errorMessage']) {
      if (typeof obj[key] !== 'string') continue;
      if (/频繁|frequency|too many/i.test(obj[key])) out.rateLimited = true;
      if (/风险|风控|risk|验证|verify/i.test(obj[key])) out.verification = true;
      if (/未登录|请登录|not.?login/i.test(obj[key])) out.loginRequired = true;
    }
  }
  if (codes.length) out.codes = codes;
  return out;
}
function createDiagnostics() {
  const entries = [];
  const push = value => { entries.push({ at: new Date().toISOString(), ...value }); if (entries.length > 100) entries.shift(); };
  function install(context) {
    context.on('requestfailed', request => {
      const target = endpoint(request.url()); if (!target) return;
      const raw = request.failure()?.errorText || '';
      const failure = raw.match(/net::ERR_[A-Z_]+/)?.[0] || 'request_failed';
      push({ ...target, type: request.resourceType(), failure });
    });
    context.on('response', async response => {
      try {
        const target = endpoint(response.url()); if (!target) return;
        const request = response.request(), type = request.resourceType(), status = response.status();
        if (!['document', 'xhr', 'fetch'].includes(type) && status < 400) return;
        const info = { ...target, type, status };
        const headers = response.headers();
        if (/json/i.test(headers['content-type'] || '') && Number(headers['content-length'] || 0) < 131072) {
          const text = await response.text();
          if (text.length < 131072) { try { Object.assign(info, signals(JSON.parse(text))); } catch {} }
        }
        push(info);
      } catch { /* A closing tab is normal; no diagnostic may crash the browser. */ }
    });
  }
  return { install, snapshot: () => entries.slice() };
}
module.exports = { endpoint, signals, createDiagnostics };
