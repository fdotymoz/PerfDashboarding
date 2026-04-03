import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/stmo': {
        target: 'https://sql.telemetry.mozilla.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/stmo/, '')
      }
    }
  }
})
