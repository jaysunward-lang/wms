import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/wms/' : '/',
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api/ai': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '/api/v1/services/aigc/text-generation/generation'),
      },
    },
  },
})
