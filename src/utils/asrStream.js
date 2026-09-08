// 流式识别客户端:麦克风 → 降采样 16k pcm → 桥 /ws/asr → 阿里百炼 Paraformer 实时版
// 边说边回 partial(这句还在变)/ final(这句定稿,通话里会有多句)
// ctx 要在用户手势里同步创建好再传进来(iOS 规矩),这里只挂/拆节点不关它
// 采集优先 AudioWorklet(iOS 上 ScriptProcessor 时灵时不灵),不行再退 ScriptProcessor
// WebSocket 没开好之前的音频先攒着,开了一次性冲出去,不丢开头的字

const WORKLET_SRC = `
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch && ch.length) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('pcm-tap', PcmTap)
`
let workletUrl = null
const workletReady = new WeakMap() // ctx -> Promise

export function openAsrSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/ws/asr`)
  ws.binaryType = 'arraybuffer'
  return ws
}

// 常备一条已连好的 WebSocket(过 Cloudflare 建连要 1.6-2.2s,按下再拨太慢);用掉一条立刻再备一条;闲置时 30s 一个 ping 免得被掐
let spare = null
function makeSpare() {
  const ws = openAsrSocket()
  const ping = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' })); else if (ws.readyState > 1) clearInterval(ping) }, 30000)
  ws.addEventListener('close', () => { clearInterval(ping); if (spare === ws) { spare = null; setTimeout(() => { if (!spare) spare = makeSpare() }, 3000) } })
  ws._ping = ping
  return ws
}
export function getWarmSocket() {
  const ws = spare && spare.readyState <= 1 ? spare : openAsrSocket()
  if (spare === ws) { clearInterval(ws._ping); spare = null }
  spare = makeSpare()
  return ws
}
if (typeof window !== 'undefined') setTimeout(() => { if (!spare) spare = makeSpare() }, 1500)

export function createAsrStream({ ctx, stream, ws, onPartial, onFinal, onError }) {
  const t0 = Date.now()
  ws = ws || openAsrSocket()
  const ratio = ctx.sampleRate / 16000
  let finals = [], partial = '', done = false, torn = false
  const stat = { frames: 0, sent: 0, queued: 0, peak: 0, openMs: null, readyMs: null, mode: '' }
  const pending = [] // ws 开好之前攒的 pcm
  let resolveDone
  const donePromise = new Promise((r) => { resolveDone = r })
  const all = () => finals.join('') + partial

  let muted = false // 通话里他说话时静音麦克风(送静音帧而不是断流,阿里那端会话不掉)
  const push = (f32) => {
    stat.frames++
    const n = Math.floor(f32.length / ratio)
    const out = new Int16Array(n)
    if (!muted) for (let i = 0; i < n; i++) { const v = f32[Math.floor(i * ratio)]; const a = v < 0 ? -v : v; if (a > stat.peak) stat.peak = a; out[i] = (v < -1 ? -1 : v > 1 ? 1 : v) * 0x7fff }
    if (ws.readyState === 1) { ws.send(out.buffer); stat.sent += n }
    else if (ws.readyState === 0) { pending.push(out.buffer); stat.queued += n }
  }
  const flush = () => { for (const b of pending) { ws.send(b); stat.sent += b.byteLength / 2 } pending.length = 0 }

  // ---- 采集 ----
  const src = ctx.createMediaStreamSource(stream)
  let node = null
  const useScript = () => {
    stat.mode = 'script'
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    proc.onaudioprocess = (e) => push(e.inputBuffer.getChannelData(0))
    src.connect(proc); proc.connect(ctx.destination)
    node = proc
  }
  const useWorklet = async () => {
    if (!ctx.audioWorklet) throw new Error('no worklet')
    if (!workletReady.get(ctx)) {
      if (!workletUrl) workletUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }))
      workletReady.set(ctx, ctx.audioWorklet.addModule(workletUrl))
    }
    await workletReady.get(ctx)
    if (torn) return
    const w = new AudioWorkletNode(ctx, 'pcm-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 })
    w.port.onmessage = (e) => push(e.data)
    src.connect(w); w.connect(ctx.destination)
    node = w; stat.mode = 'worklet'
  }
  useWorklet().catch(() => { if (!torn) useScript() })
  // 录音期间系统若把 ctx 挂起(来电/切音频会话),立刻拉回来
  const keepAlive = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}) }
  ctx.addEventListener('statechange', keepAlive); keepAlive()

  // ---- 通道 ----
  if (ws.readyState === 1) { stat.openMs = 0; flush() }
  else ws.addEventListener('open', () => { stat.openMs = Date.now() - t0; flush() })
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data) } catch { return }
    if (m.type === 'ready') stat.readyMs = Date.now() - t0
    else if (m.type === 'partial') { partial = m.text || ''; onPartial?.(all()) }
    else if (m.type === 'final') { finals.push(m.text || ''); partial = ''; onFinal?.(all(), m.text || '') }
    else if (m.type === 'done') { done = true; resolveDone(all()) }
    else if (m.type === 'error') { stat.err = m.msg; onError?.(m.msg); resolveDone(all() || null) }
  }
  ws.onerror = () => { stat.err = 'ws'; onError?.('ws'); resolveDone(all() || null) }
  ws.onclose = () => { if (!done) resolveDone(all() || null) }

  const teardown = () => {
    if (torn) return; torn = true
    try { ctx.removeEventListener('statechange', keepAlive); src.disconnect(); node?.disconnect() } catch {}
    // 传进来的是 clone 出来的流,这里负责停掉,不然 iOS 上麦克风一直被占着,之后录音全是空的
    try { stream.getTracks().forEach((tr) => tr.stop()) } catch {}
  }
  return {
    text: all,
    stat: () => ({ ...stat, peak: +stat.peak.toFixed(3) }),
    mute: (v) => { muted = !!v },
    // 松手:拆麦,发 finish,等最终结果(最多 ms 毫秒)。返回 null = 通道没成(该走兜底)
    async stop(ms = 2500) {
      teardown()
      if (ws.readyState === 1) { flush(); ws.send(JSON.stringify({ type: 'finish' })) }
      const t = await Promise.race([donePromise, new Promise((r) => setTimeout(() => r(undefined), ms))])
      try { ws.close() } catch {}
      return t === undefined ? (all() || null) : t
    },
    cancel() { teardown(); try { ws.close() } catch {} },
  }
}
