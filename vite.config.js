import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 本地开发时把 API 转发到 VPS,手机部署后前端和 API 同源
      '/api': 'http://45.77.208.204:3000',
    },
  },
})
