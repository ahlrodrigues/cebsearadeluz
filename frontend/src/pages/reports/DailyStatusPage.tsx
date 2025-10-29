import { useEffect, useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import { http } from '../../api/http'

type Summary = { date_ref: string; total: number; success: number; failure: number }
type Item = { id: number; created_at: string; user_name?: string | null; ok: boolean; ticket_number?: number | null; error?: string | null }

const DailyStatusPage = () => {
  const [dateRef, setDateRef] = useState<string>(new Date().toISOString().slice(0,10))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [s, l] = await Promise.all([
        http.get<Summary>('/reports/scan-logs/summary', { params: { date_ref: dateRef } }),
        http.get<Item[]>('/reports/scan-logs', { params: { date_ref: dateRef } }),
      ])
      setSummary(s.data)
      setItems(l.data)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Falha ao carregar status'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <style>
        {`@media print { @page { size: A4 portrait; margin: 12mm; } }`}
      </style>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Status do dia</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>Data: {dateRef}</Typography>
            <Button size="small" variant="outlined" onClick={load} disabled={loading}>Atualizar</Button>
            <Button size="small" variant="contained" onClick={() => window.print()}>Imprimir PDF</Button>
          </Stack>
          {summary && (
            <Stack direction="row" spacing={3}>
              <Typography>Total: {summary.total}</Typography>
              <Typography>Sucesso: {summary.success}</Typography>
              <Typography>Falhas: {summary.failure}</Typography>
            </Stack>
          )}
          <Box>
            <Typography variant="h6">Registros</Typography>
            <Stack spacing={0.5} sx={{ maxHeight: 420, overflow: 'auto' }}>
              {items.map((i) => (
                <Typography key={i.id} color={i.ok ? 'success.main' : 'error.main'}>
                  #{i.ticket_number ?? '-'} • {i.user_name ?? '-'} • {new Date(i.created_at).toLocaleTimeString()} {i.ok ? '' : `• ${i.error ?? ''}`}
                </Typography>
              ))}
              {items.length === 0 && <Typography color="text.secondary">Sem registros.</Typography>}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}

export default DailyStatusPage

