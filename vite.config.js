import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/quran': {
        target: 'https://cdn.islamic.network',
        changeOrigin: true,
      },
      '/everyayah': {
        target: 'https://everyayah.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/everyayah/, ''),
      },
      '/api/tts': {
        target: 'https://translate.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tts/, '/translate_tts'),
        headers: {
          Referer: 'https://translate.google.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    }
  }
})
