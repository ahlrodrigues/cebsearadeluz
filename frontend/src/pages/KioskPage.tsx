import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Checkbox, Container, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'
import { scanPassPresenceKiosk, type ScanKioskResponse } from '../api/passes'

type Entry = {
  ts: string
  ok: boolean
  message: string
}

const KioskPage = () => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [buffer, setBuffer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ ok: boolean; userName?: string; ticket?: number; message: string } | null>(null)
  const [printOnSuccess, setPrintOnSuccess] = useState<boolean>(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const pushEntry = (ok: boolean, msg: string) => {
    const e: Entry = { ts: new Date().toLocaleTimeString(), ok, message: msg }
    setEntries((prev) => [e, ...prev].slice(0, 20))
  }

  type AudioContextConstructor = { new (): AudioContext }
  const playTone = (ok: boolean) => {
    try {
      const w = window as unknown as {
        AudioContext?: AudioContextConstructor
        webkitAudioContext?: AudioContextConstructor
      }
      const Ctx = w.AudioContext ?? w.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = ok ? 880 : 220
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
      o.start()
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      o.stop(ctx.currentTime + 0.25)
    } catch (err) {
      void err
    }
  }

  const submitToken = async (token: string) => {
    if (!token.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res: ScanKioskResponse = await scanPassPresenceKiosk({ token: token.trim() })
      pushEntry(true, `#${res.ticket_number} • ${res.user_name} • sessão ${res.session.sequence_index}`)
      setBanner({ ok: true, userName: res.user_name, ticket: res.ticket_number, message: `Sessão ${res.session.sequence_index}` })
      playTone(true)
      if (printOnSuccess) {
        setTimeout(() => window.print(), 100)
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message || 'Erro'
      const msg = String(detail || message)
      pushEntry(false, msg)
      setBanner({ ok: false, message: msg })
      playTone(false)
      setError(String(detail || message))
    } finally {
      setSubmitting(false)
      setBuffer('')
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      const token = buffer
      submitToken(token)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Leitor de presenças</Typography>
          {banner && (
            <Alert severity={banner.ok ? 'success' : 'error'} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              {banner.ok ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">{banner.userName}</Typography>
                  <Typography variant="subtitle1">Ticket #{banner.ticket}</Typography>
                </Stack>
              ) : (
                <Typography variant="subtitle1">{banner.message}</Typography>
              )}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">Aponte o leitor para o QR e aguarde a confirmação.</Typography>
          <FormControlLabel
            control={<Checkbox checked={printOnSuccess} onChange={(e) => setPrintOnSuccess(e.target.checked)} />}
            label="Imprimir ticket automaticamente ao registrar"
          />
          <Box>
            <TextField
              inputRef={inputRef}
              label="Entrada do leitor"
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              disabled={submitting}
              fullWidth
            />
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Typography variant="h6">Últimas leituras</Typography>
            <Stack spacing={1} sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {entries.map((e, i) => (
                <Alert key={i} severity={e.ok ? 'success' : 'error'}>
                  [{e.ts}] {e.message}
                </Alert>
              ))}
              {entries.length === 0 && (
                <Typography color="text.secondary">Aguardando leituras…</Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}

export default KioskPage
