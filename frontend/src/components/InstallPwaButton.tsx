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
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome !== 'accepted') {
      // ignore
    }
    setDeferredPrompt(null)
  }

  if (!supported) return null
  return (
    <Button color="inherit" onClick={onInstall}>Instalar app</Button>
  )
}

export default InstallPwaButton

