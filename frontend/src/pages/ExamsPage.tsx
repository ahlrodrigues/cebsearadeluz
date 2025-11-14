import { useEffect, useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { fetchExamQueue, scheduleExam, completeExam, type ExamQueueItem } from '../api/exam_ops'
import { Link as RouterLink } from 'react-router-dom'

const todayISO = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const ExamsPage = () => {
  const [items, setItems] = useState<ExamQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<number, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchExamQueue()
      setItems(Array.isArray(data) ? data : [])
      // initialize date inputs using scheduled date or today
      const initial: Record<number, string> = {}
      for (const it of data) {
        initial[it.user_id] = (it.scheduled_for ?? todayISO())
      }
      setDates(initial)
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
  }, [])

  const handleSchedule = async (userId: number) => {
    setActionError(null)
    try {
      const when = dates[userId] || todayISO()
      await scheduleExam(userId, when)
      await load()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message || 'Erro ao agendar'
      setActionError(String(detail || message))
    }
  }

  const handleComplete = async (userId: number) => {
    setActionError(null)
    try {
      await completeExam(userId)
      await load()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message || 'Erro ao concluir exame'
      setActionError(String(detail || message))
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Exames</Typography>
          <Typography color="text.secondary">
            Lista de assistidos que concluíram o ciclo com sucesso (4 presenças e no máximo 2 ausências) e aguardam entrevista/exame.
          </Typography>
          <Box display="flex" gap={1}>
            <Button variant="outlined" onClick={load} disabled={loading}>Atualizar</Button>
            <Button variant="outlined" onClick={() => window.print()}>Imprimir</Button>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {actionError && <Alert severity="warning">{actionError}</Alert>}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Agendado para</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it) => (
                <TableRow key={`${it.user_id}:${it.cycle_id}`}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell>{it.pass_type ?? ''}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="date"
                      value={dates[it.user_id] ?? todayISO()}
                      onChange={(e) => setDates((d) => ({ ...d, [it.user_id]: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => handleSchedule(it.user_id)}>Agendar</Button>
                      <Button size="small" variant="contained" onClick={() => handleComplete(it.user_id)}>Concluir</Button>
                      <Button size="small" component={RouterLink} to={`/users/${it.user_id}/exam`}>Ficha</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">Nenhum cadastro pendente de exame.</Typography>
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

export default ExamsPage
