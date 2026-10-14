// Keep everyday app actions in the heart timeline; surface development work in chat.
export function isDevelopmentTool(text) {
 const value=String(text||'')
 if(/\/api\/(?:together|moments|diary|gallery|memory|echo|tasks|plans|wake|calls|location|mind|quiz)|ombre[.\s]|diary-outbox|wake-outbox/i.test(value))return false
 return /(?:\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|test|lint|install|ci|dev)\b|\bgit\s+(?:diff|status|show|commit|add|push|pull|checkout|switch|log)\b|apply_patch|(?:[\w./\\-]+\.(?:jsx|tsx|js|mjs|cjs|ts|css|scss|py|sh|html|vue|svelte))\b|(?:package|tsconfig|vite\.config)\.json)/i.test(value)
}
