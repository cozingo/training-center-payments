import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API runs separately (see ../backend). In dev, /api/* is proxied to it.
const apiTarget = process.env.API_URL ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    proxy: {
      '/api': { target: apiTarget, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
})
