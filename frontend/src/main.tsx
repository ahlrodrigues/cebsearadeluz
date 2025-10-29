import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './index.css'
import { theme } from './theme'
import DevErrorBoundary from './components/DevErrorBoundary'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV ? (
      <DevErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <AuthProvider>
                <App />
              </AuthProvider>
            </ThemeProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </DevErrorBoundary>
    ) : (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    )}
  </StrictMode>,
)

// Registrar um service worker simples para permitir instalação (PWA)
// Registra o service worker em produção e também no dev quando em HTTPS
if ('serviceWorker' in navigator) {
  const shouldRegister = import.meta.env.PROD || (window.location.protocol === 'https:')
  if (shouldRegister) {
    window.addEventListener('load', () => {
      const swUrl = new URL('sw.js', import.meta.env.BASE_URL).toString()
      navigator.serviceWorker.register(swUrl).catch(() => void 0)
    })
  }
}
