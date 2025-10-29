import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Container, Paper, Stack, TextField, Typography, Divider, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { scanPassPresenceKiosk, type ScanKioskResponse, fetchActivePassCycle } from '../api/passes'
import { reserveTickets } from '../api/tickets'

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
  const [lastTicket, setLastTicket] = useState<{ ticket: number; userName: string; showInterview: boolean } | null>(null)
  // Avulsas
  const [passType, setPassType] = useState<string>('P1')
  const [count, setCount] = useState<number>(1)
  const [printing, setPrinting] = useState(false)
  const [reserved, setReserved] = useState<{ ticket_number: number }[] | null>(null)
  // Sempre imprimir ticket ao registrar e auto-enviar quando o leitor não mandar Enter

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus()
    focusInput()
    // Manter o foco no campo de entrada sempre que a página ganhar foco/click
    window.addEventListener('focus', focusInput)
    document.addEventListener('click', focusInput)
    document.addEventListener('visibilitychange', focusInput)
    return () => {
      window.removeEventListener('focus', focusInput)
      document.removeEventListener('click', focusInput)
      document.removeEventListener('visibilitychange', focusInput)
    }
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
      // Verificar se o ciclo ativo requer entrevista
      let showInterview = false
      try {
        const cycle = await fetchActivePassCycle(res.user_id)
        showInterview = Boolean(cycle?.requires_interview)
      } catch {}
      setLastTicket({ ticket: res.ticket_number, userName: res.user_name, showInterview })
      playTone(true)
      // Sempre imprimir o ticket
      setTimeout(() => window.print(), 200)
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

  // Auto-submit quando o leitor não envia Enter: dispara após brevíssima inatividade
  // Evita acionar durante digitação humana exigindo um tamanho mínimo de buffer
  useEffect(() => {
    if (submitting) return
    const trimmed = buffer.trim()
    if (!trimmed) return
    if (trimmed.length < 6) return // scanners normalmente geram tokens mais longos
    const t = setTimeout(() => {
      submitToken(trimmed)
    }, 180)
    return () => clearTimeout(t)
  }, [buffer, submitting])

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* CSS de impressão: exibe apenas o ticket */}
      <style>
        {`@media print {
          @page { size: 80mm auto; margin: 5mm; }
          body * { visibility: hidden; }
          #print-ticket, #print-ticket * { visibility: visible; }
          #print-ticket { position: fixed; inset: 0; margin: 0 auto; width: 72mm; padding: 0; text-align: center; }
          #print-ticket .title { font-size: 24pt; font-weight: 800; margin: 4mm 0 2mm; }
          #print-ticket .name { font-size: 14pt; margin: 1mm 0; }
          #print-ticket .date { font-size: 11pt; margin: 2mm 0 3mm; }
          #print-ticket .note { font-size: 12pt; margin: 2mm 0; }
          #print-ticket hr { border: none; border-top: 1px dashed #666; margin: 2mm 8mm; }
        }`}
      </style>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Card de senhas avulsas */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Imprimir senhas avulsas</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Tipo de passe</InputLabel>
                <Select label="Tipo de passe" value={passType} onChange={(e) => setPassType(String(e.target.value))}>
                  {['P1','P2','P3A','P3B','CH','P4A','P4B'].map(t => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                type="number"
                label="Quantidade"
                inputProps={{ min: 1, max: 20 }}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
              <Button
                variant="contained"
                disableElevation
                disabled={printing}
                onClick={async () => {
                  try {
                    setPrinting(true)
                    const items = await reserveTickets({ count, pass_type: passType })
                    setReserved(items)
                    setTimeout(() => window.print(), 0)
                  } finally {
                    setPrinting(false)
                  }
                }}
              >
                {printing ? 'Gerando…' : 'Imprimir'}
              </Button>
            </Stack>
            {reserved && reserved.length > 0 && (
              <Box mt={2} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 2 }}>
                {reserved.map(r => (
                  <Box key={r.ticket_number} sx={{ border: '1px dashed', p: 2, textAlign: 'center' }}>
                    <Typography variant="overline" display="block">Senha</Typography>
                    <Typography variant="h4" fontWeight={700}>{r.ticket_number}</Typography>
                    <Typography variant="body2" color="text.secondary">{passType}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
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
          {/* Impressão automática e auto-envio sempre ativos */}
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
          {/* Conteúdo do ticket para impressão */}
          <Box id="print-ticket" sx={{ display: lastTicket ? 'block' : 'none', bgcolor: 'white', color: 'black', p: 2, textAlign: 'center' }}>
            {lastTicket && (
              <Stack spacing={1} alignItems="center">
                <Typography className="title">Passe {String(lastTicket.ticket).padStart(3, '0')}</Typography>
                <Divider flexItem />
                <Typography className="name">{lastTicket.userName}</Typography>
                <Typography className="date" color="text.secondary">{new Date().toLocaleDateString()}</Typography>
                {lastTicket.showInterview && (
                  <Typography className="note">Aguarde a entrevista!</Typography>
                )}
              </Stack>
            )}
          </Box>
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
