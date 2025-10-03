import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on all interfaces for LAN/devices
    strictPort: true,
    proxy: {
      '/users': 'http://127.0.0.1:8000',
      '/passes': 'http://127.0.0.1:8000',
      '/auth': 'http://127.0.0.1:8000',
      '/openapi.json': 'http://127.0.0.1:8000',
      '/docs': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
})
