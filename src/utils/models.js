export const DEFAULT_MODEL = 'anthropic/claude-opus-4.6'
export const FALLBACK_MODELS = [
  ['Opus 4.6', 'anthropic/claude-opus-4.6'],
  ['Sonnet 4.6', 'anthropic/claude-sonnet-4.6'],
  ['Haiku 4.5', 'anthropic/claude-haiku-4.5'],
  ['Opus 4.7', 'anthropic/claude-opus-4.7'],
  ['Opus 4.8', 'anthropic/claude-opus-4.8'],
  ['Opus 5', 'anthropic/claude-opus-5'],
  ['Sonnet 5', 'anthropic/claude-sonnet-5'],
  ['Fable 5', 'anthropic/claude-fable-5'],
].map(([label, id]) => ({ label, id }))

export function cachedModels() {
  let models = FALLBACK_MODELS
  try {
    const saved = JSON.parse(localStorage.getItem('chat-model-catalog') || 'null')
    if (Array.isArray(saved) && saved.length && saved.every(m => (/^anthropic\/claude-(opus|sonnet|haiku|fable)-\d+(\.\d+)?$/.test(m.id) || /^codex\/[a-zA-Z0-9_.-]+$/.test(m.id) || /^account\/claude-(opus|sonnet|haiku|fable)-\d+(-\d+)?$/.test(m.id)) && typeof m.label === 'string')) models = saved
    const id = localStorage.getItem('chat-model-id')
    const match = id?.match(/^anthropic\/claude-(opus|sonnet|haiku|fable)-(\d+(?:\.\d+)?)$/)
    if (match && !models.some(m => m.id === id)) models = [...models, { id, label: `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]}` }]
  } catch {}
  return models
}

export function selectedModel(models, saved, defaultId = DEFAULT_MODEL) {
  return models.find(m => m.label === saved || m.id === saved) || models.find(m => m.id === defaultId) || models[0] || FALLBACK_MODELS[0]
}

export function modelPrice(model) {
  if (model.engine === 'codex' || model.id.startsWith('codex/')) return model.disabled ? '等待登录 ChatGPT' : '使用 ChatGPT 订阅额度'
  if (model.id.startsWith('account/')) return model.disabled ? '等待登录 Claude 账号' : '使用 Claude 订阅额度'
  if (model.input_price == null || model.output_price == null) return ''
  const format = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `输入 $${format(model.input_price)} · 输出 $${format(model.output_price)} / 百万 tokens`
}
