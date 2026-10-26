import { useEffect, useState } from 'react'
export default function ShoppingImage({ src, alt, ...props }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let live = true, objectUrl
    if (!src?.startsWith('/api/')) { setUrl(src || ''); return }
    setUrl(''); const controller = new AbortController()
    fetch(src, { cache: 'no-store', signal: controller.signal }).then(r => { if (!r.ok) throw Error(); return r.blob() }).then(blob => { objectUrl = URL.createObjectURL(blob); if (live) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl) }).catch(() => {})
    return () => { live = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [src])
  return url ? <img src={url} alt={alt} {...props} /> : <span className="shop-image-pending">图片暂未显示</span>
}
