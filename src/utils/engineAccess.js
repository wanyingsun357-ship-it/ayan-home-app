let pending = null
export function requestEnginePair() {
  if (!pending) {
    pending = new Promise(resolve => {
      const request = { resolve }
      window.__ayanPairRequest = request
      window.dispatchEvent(new CustomEvent('ayan:pair', { detail: request }))
    })
      .finally(() => { pending = null })
  }
  return pending
}
export function installEngineAccess() {
  if (window.__ayanEngineAccess) return
  window.__ayanEngineAccess = true
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const response = await original(input, init)
    const url = typeof input === 'string' ? input : input?.url
    if (response.status !== 401 || !url || !new URL(url, location.href).pathname.startsWith('/api/')) return response
    let body
    try { body = await response.clone().json() } catch { return response }
    if (body.error !== 'device_pairing_required') return response
    if (await requestEnginePair()) return original(input, init)
    return response
  }
}
