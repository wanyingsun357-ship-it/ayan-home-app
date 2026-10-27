const assert = require('assert/strict');
const {allowed,httpsNavigation} = require('./shopping-browser-worker.cjs');
assert.equal(allowed('https://sso.jd.hk/sso/sync/redirect?fixture=1'),true);
for (const u of ['https://sso.jd.hk/other','https://evil.jd.hk/sso/sync/redirect','https://sso.jd.hk.evil.test/sso/sync/redirect','https://jd.com.evil.test/','https://jd.com@evil.test/','https://127.0.0.1/','https://www.jd.com:8443/','http://www.jd.com/']) assert.equal(allowed(u),false,u);
const query='?rurl=%2F%2Faq.jd.com%2Fcertified%2Findex%3Fx%3D1&fixture=a%2Bb%26c&empty=';
assert.equal(httpsNavigation('http://passport.jd.com/relay/loginRelay'+query),'https://passport.jd.com/relay/loginRelay'+query);
assert.equal(httpsNavigation('http://www.jd.com/'),'https://www.jd.com/');
for(const u of ['http://evil.test/','http://www.jd.com:8080/','http://user:pass@jd.com/','http://sso.jd.hk/other','https://www.jd.com/'])assert.equal(httpsNavigation(u),null,u);
console.log('Navigation allowlist, HTTPS upgrade and encoded query preservation passed; no network requests');
