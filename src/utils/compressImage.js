// 图片上传前压缩:长边≤1400px,JPEG 85%
// 省的不只是上传流量——阿晏看图的 vision token 跟像素成正比,压一半像素就省一半额度
const MAX_EDGE = 1400
const QUALITY = 0.85

// 带重试的上传:跨境链路大POST容易被掐,失败自动重试3次(每次25秒超时,间隔递增)
export async function postUpload(name, base64, tries = 3) {
  let lastErr = null
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 25000)
      const r = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: base64 }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (r.ok) return await r.json()
      lastErr = new Error('http ' + r.status)
    } catch (e) { lastErr = e }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)))
  }
  throw lastErr || new Error('upload failed')
}

// 返回 { base64(不带data:前缀), name(扩展名改.jpg), type }
// 压不了(gif动图/解码失败/压完反而更大)就原样返回
export async function compressImage(file) {
  const raw = () => new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve({ base64: fr.result.split(',')[1], name: file.name, type: file.type })
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return raw()
  // 双路解码:createImageBitmap失败(iOS部分格式)就退回<img>解码,尽量不走原图直传
  const decode = async () => {
    try { return await createImageBitmap(file) } catch {}
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const im = new Image()
      im.onload = () => { resolve(im); URL.revokeObjectURL(url) }
      im.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
      im.src = url
    })
  }
  try {
    const bmp = await decode()
    const bw = bmp.naturalWidth || bmp.width
    const bh = bmp.naturalHeight || bmp.height
    const scale = Math.min(1, MAX_EDGE / Math.max(bw, bh))
    const w = Math.round(bw * scale)
    const h = Math.round(bh * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    // 透明底铺白,不然PNG转JPEG透明区会变黑
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    // 自适应二压:还是太大就再降一档(跨境链路对大POST很不友好,小=传得上)
    if (blob && blob.size > 350 * 1024) {
      const scale2 = Math.min(1, 1080 / Math.max(w, h))
      const c2 = document.createElement('canvas')
      c2.width = Math.round(w * scale2); c2.height = Math.round(h * scale2)
      const ctx2 = c2.getContext('2d')
      ctx2.fillStyle = '#fff'; ctx2.fillRect(0, 0, c2.width, c2.height)
      ctx2.drawImage(canvas, 0, 0, c2.width, c2.height)
      const b2 = await new Promise((resolve) => c2.toBlob(resolve, 'image/jpeg', 0.72))
      if (b2 && b2.size < blob.size) blob = b2
    }
    if (!blob || blob.size >= file.size) return raw()
    const base64 = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result.split(',')[1])
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    return { base64, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' }
  } catch {
    return raw()
  }
}
