// Native keyboard overlays and browser viewport resizing need one height source.
export function installKeyboardViewport({ native = false, keyboard } = {}) {
  const root = document.documentElement, viewport = window.visualViewport
  let nativeHeight = 0, largest = viewport?.height || window.innerHeight, opened = false, disposed = false
  const editable = () => document.activeElement?.matches('textarea,input:not([type=range]):not([type=file]):not([type=checkbox])')
  const update = () => {
    if (disposed) return
    const visible = native ? Math.max(0, window.innerHeight - nativeHeight) : (viewport?.height || window.innerHeight)
    if (!editable()) largest = Math.max(largest, visible)
    const open = native ? nativeHeight > 100 : !!editable() && largest - visible > 120
    root.style.setProperty('--app-viewport-height', visible + 'px')
    root.dataset.keyboard = open ? 'open' : 'closed'
    if (opened !== open) {
      opened = open
      window.dispatchEvent(new CustomEvent('kb', { detail: native ? nativeHeight : Math.max(0, window.innerHeight - visible) }))
    }
  }
  const setNative = height => {
    nativeHeight = Math.max(0, Number(height) || 0)
    root.style.setProperty('--kb', nativeHeight + 'px')
    update()
    window.dispatchEvent(new CustomEvent('kb', { detail: nativeHeight }))
  }
  const rotate = () => { largest = viewport?.height || window.innerHeight; update() }
  const listeners = native && keyboard ? [
    keyboard.addListener('keyboardWillShow', e => setNative(e.keyboardHeight)),
    keyboard.addListener('keyboardWillHide', () => setNative(0)),
  ] : []
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', rotate)
  viewport?.addEventListener('resize', update)
  document.addEventListener('focusin', update)
  document.addEventListener('focusout', update)
  update()
  return () => {
    disposed = true
    listeners.forEach(p => Promise.resolve(p).then(h => h.remove()).catch(() => {}))
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', rotate)
    viewport?.removeEventListener('resize', update)
    document.removeEventListener('focusin', update)
    document.removeEventListener('focusout', update)
    root.style.removeProperty('--app-viewport-height')
    root.style.removeProperty('--kb')
    delete root.dataset.keyboard
  }
}
