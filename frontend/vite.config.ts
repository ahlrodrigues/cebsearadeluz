import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
    },
  },
  server: {
    port: 5173,
    host: true, // listen on all interfaces for LAN/devices
    strictPort: true,
    https: (() => {
      const enable = process.env.DEV_HTTPS === '1' || process.env.HTTPS === 'true'
      if (!enable) return undefined
      const keyPath = process.env.DEV_TLS_KEY || path.resolve(__dirname, 'certs', 'dev.key')
      const certPath = process.env.DEV_TLS_CERT || path.resolve(__dirname, 'certs', 'dev.crt')
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
      }
      console.warn('[vite] DEV_HTTPS set but certs not found; disable https or provide certs')
      return undefined
    })(),
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
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', '@mui/material', '@mui/icons-material'],
  },
})
