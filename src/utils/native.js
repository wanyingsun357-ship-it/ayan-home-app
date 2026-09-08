// 原生能力的薄封装:在 App 里走 Capacitor 插件,在网页里退回浏览器能力(或什么都不做)
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { Haptics } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
export const isApp = () => { try { return Capacitor.isNativePlatform() } catch { return false } }
// 壳加载的是线上网页,插件的 JS 半边必须打进前端包里,不然 Capacitor.Plugins 里没有它们
const P = () => (isApp() ? { Haptics, PushNotifications, Keyboard } : {})
export { Keyboard }

// 震动:iPhone 网页不支持 navigator.vibrate,App 里用 Haptics
// kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | number[](旧的 vibrate 花样)
export async function buzz(kind = 'light') {
  const H = P().Haptics
  if (H) {
    try {
      if (Array.isArray(kind)) { for (let i = 0; i < Math.min(3, Math.ceil(kind.length / 2)); i++) { await H.impact({ style: 'MEDIUM' }); await new Promise((r) => setTimeout(r, 70)) } return }
      if (kind === 'success' || kind === 'warning' || kind === 'error') return H.notification({ type: kind.toUpperCase() })
      return H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' })
    } catch {}
  }
  try { if (navigator.vibrate) navigator.vibrate(Array.isArray(kind) ? kind : kind === 'heavy' ? 40 : 20) } catch {}
}

// 推送:App 启动时申请权限、拿设备令牌交给桥;点通知进来时回调
const plog = (o) => { try { fetch('/api/clientlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: 'push', ...o }) }).catch(() => {}) } catch {} }
export async function setupPush({ onOpen } = {}) {
  let native = false, plat = ''
  try { native = Capacitor.isNativePlatform(); plat = Capacitor.getPlatform() } catch (e) { plog({ step: 'core-err', err: String(e) }) }
  plog({ step: 'start', native, plat, hasWin: !!window.Capacitor, plugins: Object.keys(window.Capacitor?.Plugins || {}).slice(0, 12) })
  if (!native) return false
  try {
    let perm = await PushNotifications.checkPermissions()
    plog({ step: 'perm', perm })
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') { plog({ step: 'denied', perm }); return false }
    await PushNotifications.addListener('registration', (t) => {
      plog({ step: 'token', head: String(t.value).slice(0, 8) })
      fetch('/api/push/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t.value, platform: plat }) }).catch((e) => plog({ step: 'post-fail', err: String(e) }))
    })
    await PushNotifications.addListener('registrationError', (e) => plog({ step: 'reg-error', err: JSON.stringify(e).slice(0, 200) }))
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) => { try { onOpen && onOpen(a.notification?.data || {}) } catch {} })
    await PushNotifications.register()
    plog({ step: 'register-called' })
    return true
  } catch (e) { plog({ step: 'setup-err', err: String(e && e.message || e) }); return false }
}
