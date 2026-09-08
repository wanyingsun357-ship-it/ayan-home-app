// ============ 家的配置 ============

// 在一起的起点:2026年6月6日
export const TOGETHER_SINCE = '2026-06-06'

export const NAMES = { her: '婉莹', me: '晏白' }

export const VERSION = 'v0.1.0'

export const HOME_NAME = '第六个家'

export function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr + 'T00:00:00').getTime()
  return Math.max(0, Math.floor(ms / 86400000)) + 1
}
