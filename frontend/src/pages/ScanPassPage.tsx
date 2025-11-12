import { useEffect, useRef, useState } from 'react'
import { Box, Button, Container, Paper, Stack, TextField, Typography, Alert } from '@mui/material'
import { scanPassPresence, type PassScanPayload } from '../api/passes'

const ScanPassPage = () => {
  const [token, setToken] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)

  const onSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload: PassScanPayload = {
        notes: 'Presença via QR (manual)'
      }
      // Prefira enviar user_id quando disponível
      if (userId.trim()) {
        payload.user_id = Number(userId.trim())
      } else if (token.trim()) {
        payload.token = token.trim()
      }
      {
        const d = new Date()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        payload.date = `${y}-${m}-${day}`
      }
      const res = await scanPassPresence(payload)
      setResult(`OK: sessão #${res.sequence_index} em ${res.scheduled_for}`)
    } catch (e: unknown) {
      const responseDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(responseDetail || message || 'Erro'))
    } finally {
      setLoading(false)
    }
  }

  // Quando o token mudar, tente extrair o ID do usuário
  useEffect(() => {
    const t = token.trim()
    if (!t) return
    // só atualiza se o campo ID estiver vazio
    if (userId.trim()) return
    if (/^\d+$/.test(t)) {
      setUserId(t)
      return
    }
    if (t.startsWith('{') && t.endsWith('}')) {
      try {
        const parsed = JSON.parse(t) as { id?: number | string; user_id?: number | string }
        const candidate = parsed.user_id ?? parsed.id
        if (typeof candidate === 'number') setUserId(String(candidate))
        else if (typeof candidate === 'string' && /^\d+$/.test(candidate)) setUserId(candidate)
      } catch {
        // ignore
      }
    }
  }, [token, userId])

  const stopScan = () => {
    setScanning(false)
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => stopScan()
  }, [])

  const startScan = async () => {
    setError(null)
    setResult(null)
    if (!(navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices)) {
      setError('Este navegador não suporta acesso à câmera.')
      return
    }
    // @ts-expect-error BarcodeDetector may not exist in TS lib
    const Supported = typeof window !== 'undefined' && !!window.BarcodeDetector
    if (!Supported) {
      setError('BarcodeDetector não suportado. Use o campo Token ou outro navegador (Chrome/Edge).')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        type MediaVideo = HTMLVideoElement & { srcObject: MediaStream | null }
        const v = videoRef.current as MediaVideo
        v.srcObject = stream
        await v.play()
      }
      // @ts-expect-error BarcodeDetector may not exist in TS lib
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      setScanning(true)
      intervalRef.current = window.setInterval(async () => {
        try {
          if (!videoRef.current) return
          const codes = await detector.detect(videoRef.current)
          const qr = codes?.[0]
          if (qr?.rawValue) {
            setToken(qr.rawValue)
            stopScan()
            onSubmit()
          }
        } catch {
          // ignore transient errors
        }
      }, 300)
    } catch (e: unknown) {
      const message = (e as Error)?.message
      setError(message || 'Erro ao acessar câmera')
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Registro de Presença via QR</Typography>
          <Typography variant="body2" color="text.secondary">
            Informe o token lido do QR Code ou o ID do usuário.
          </Typography>
          <Box>
            {!scanning ? (
              <Button variant="outlined" onClick={startScan}>Iniciar câmera</Button>
            ) : (
              <Button variant="outlined" color="secondary" onClick={stopScan}>Parar câmera</Button>
            )}
          </Box>
          <video ref={videoRef} style={{ width: '100%', maxHeight: 240, display: scanning ? 'block' : 'none' }} />
          <TextField
            label="Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            fullWidth
          />
          <TextField
            label="ID do usuário"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            type="number"
            fullWidth
          />
          <Box>
            <Button variant="contained" onClick={onSubmit} disabled={loading || (!token.trim() && !userId.trim())}>
              {loading ? 'Registrando...' : 'Registrar Presença'}
            </Button>
          </Box>
          {result && <Alert severity="success">{result}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>
    </Container>
  )
}

export default ScanPassPage
