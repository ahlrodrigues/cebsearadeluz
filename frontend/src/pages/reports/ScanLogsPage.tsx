import { useEffect, useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { fetchScanLogs, fetchScanLogsSummary, type ScanLog, type ScanLogsSummary } from '../../api/reports'

const todayISO = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const ScanLogsPage = () => {
  const [date, setDate] = useState<string>(todayISO())
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [summary, setSummary] = useState<ScanLogsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, sum] = await Promise.all([
        fetchScanLogs(date),
        date ? fetchScanLogsSummary(date) : Promise.resolve(null),
      ])
      setLogs(data)
      setSummary(sum as ScanLogsSummary | null)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message || 'Erro'
      setError(String(detail || message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Relatório de leituras (dia)</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Data"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={load} disabled={loading}>Atualizar</Button>
            <Button variant="outlined" onClick={() => window.print()}>Imprimir</Button>
          </Box>
          {summary && (
            <Alert severity="info">Total: {summary.total} • Sucesso: {summary.success} • Erro: {summary.failure}</Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hora</TableCell>
                <TableCell>OK</TableCell>
                <TableCell>Ticket</TableCell>
                <TableCell>Usuário</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Erro</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.created_at).toLocaleTimeString()}</TableCell>
                  <TableCell>{log.ok ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>{log.ticket_number ?? ''}</TableCell>
                  <TableCell>{log.user_name ?? log.user_id ?? ''}</TableCell>
                  <TableCell>{log.token_type ?? ''}</TableCell>
                  <TableCell>{log.error ?? ''}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">Sem leituras para a data.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </Paper>
    </Container>
  )
}

export default ScanLogsPage
