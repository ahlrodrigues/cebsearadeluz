import { useEffect, useState } from 'react'
import { Button } from '@mui/material'

// Hook into beforeinstallprompt to offer an install button for PWA
const InstallPwaButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setSupported(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const onInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      try {
        await deferredPrompt.userChoice
      } finally {
        setDeferredPrompt(null)
      }
      return
    }
    // Fallback: instruções simples por plataforma
    const ua = navigator.userAgent || ''
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    const isAndroid = /Android/.test(ua)
    if (isIOS) {
      alert('iOS: acesse o menu (Compartilhar) e escolha “Adicionar à Tela de Início”.')
    } else if (isAndroid) {
      alert('Android: acesse o menu (⋮) e escolha “Adicionar à tela inicial”.')
    } else {
      alert('Desktop: acesse o menu do navegador (Chrome/Edge) e escolha “Instalar app”.')
    }
  }

  // Sempre exibir um link de texto para instalar
  return <Button color="inherit" onClick={onInstall}>Instalar app</Button>
}

export default InstallPwaButton
