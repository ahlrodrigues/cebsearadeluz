import { defineConfig, type ProxyOptions } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'
import react from '@vitejs/plugin-react'

const BACKEND_URL = 'http://127.0.0.1:8000'

// Prefixes like /users also name frontend routes (/users/:id/edit etc.).
// A real API call (axios/fetch) should hit the backend, but a full browser
// navigation/refresh to the same path (Accept: text/html) must fall through
// to Vite's own SPA handling so React Router can render it - otherwise the
// backend's `{"detail":"Not Found"}` JSON is shown instead of the app.
// Browsers send `Accept: text/html...` for navigations; axios/fetch calls
// from the app never do, so this header is a reliable way to tell them apart.
const apiOnly = (target: string): ProxyOptions => ({
  target,
  bypass: (req: IncomingMessage) => {
    if (req.headers.accept?.includes('text/html')) {
      return req.url
    }
  },
})

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
      '/users': apiOnly(BACKEND_URL),
      '/passes': apiOnly(BACKEND_URL),
      '/auth': apiOnly(BACKEND_URL),
      '/public': apiOnly(BACKEND_URL),
      '/openapi.json': apiOnly(BACKEND_URL),
      // /docs is FastAPI's own Swagger page - always meant to be opened
      // directly in the browser as HTML, so it must always proxy through.
      '/docs': BACKEND_URL,
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
