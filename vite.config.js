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
      }
    }
  }
})
