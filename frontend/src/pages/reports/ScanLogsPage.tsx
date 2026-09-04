import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, Divider, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { fetchScanLogs, fetchScanLogsSummary, type ScanLog, type ScanLogsSummary } from '../../api/reports'
import { fetchExamQueue, type ExamQueueItem } from '../../api/exam_ops'
import { fetchCompletedInterviews, type InterviewItem } from '../../api/interviews'

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
  const [queue, setQueue] = useState<ExamQueueItem[]>([])
  const [queueError, setQueueError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<InterviewItem[]>([])
  const [completedError, setCompletedError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, sum] = await Promise.all([
        fetchScanLogs(date),
        date ? fetchScanLogsSummary(date) : Promise.resolve(null),
      ])
      setLogs(Array.isArray(data) ? data : [])
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

  const loadQueues = async () => {
    try {
      setQueueError(null)
      const items = await fetchExamQueue()
      setQueue(Array.isArray(items) ? items : [])
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message || 'Erro'
      setQueueError(String(detail || message))
    }
  }

  const loadCompleted = async () => {
    try {
      setCompletedError(null)
      const items = await fetchCompletedInterviews()
      setCompleted(Array.isArray(items) ? items : [])
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message || 'Erro'
      setCompletedError(String(detail || message))
    }
  }

  useEffect(() => {
    // load auxiliary lists once
    loadQueues()
    loadCompleted()
  }, [])

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
                <TableCell>Preferencial</TableCell>
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
                  <TableCell>{log.is_preferential ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>{log.user_name ?? log.user_id ?? ''}</TableCell>
                  <TableCell>{log.token_type ?? ''}</TableCell>
                  <TableCell>{log.error ?? ''}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary">Sem leituras para a data.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Marcados para exame</Typography>
            <Chip label={queue.length} size="small" color="primary" variant="outlined" />
            <Button size="small" onClick={loadQueues}>Atualizar</Button>
          </Stack>
          {queueError && <Alert severity="error">{queueError}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Agendado para</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.map((q) => (
                <TableRow key={`${q.user_id}:${q.cycle_id}`}>
                  <TableCell>{q.name}</TableCell>
                  <TableCell>{q.pass_type ?? ''}</TableCell>
                  <TableCell>{q.scheduled_for ?? ''}</TableCell>
                </TableRow>
              ))}
              {queue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">Nenhum cadastro marcado para exame.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Exames prontos</Typography>
            <Chip label={completed.length} size="small" color="primary" variant="outlined" />
            <Button size="small" onClick={loadCompleted}>Atualizar</Button>
          </Stack>
          {completedError && <Alert severity="warning">{completedError}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Próximo passe</TableCell>
                <TableCell>Tipo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {completed.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell>{it.next_pass_date ?? ''}</TableCell>
                  <TableCell>{it.pass_type ?? ''}</TableCell>
                </TableRow>
              ))}
              {completed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">Nenhum exame pronto.</Typography>
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
