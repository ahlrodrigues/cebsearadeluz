import { useEffect, useState } from 'react'
import { Alert, Button, Container, Paper, Stack, TextField, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material'
import { fetchCompletedInterviews, type InterviewItem } from '../api/interviews'
import { fetchExamToday, type ExamQueueItem } from '../api/exam_ops'

const InterviewDashboard = () => {
  const [items, setItems] = useState<InterviewItem[]>([])
  const [todayQueue, setTodayQueue] = useState<ExamQueueItem[]>([])
  const [errorQueue, setErrorQueue] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const data = await fetchCompletedInterviews(search.trim() || undefined)
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Erro ao carregar lista'))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadToday = async () => {
    try {
      setErrorQueue(null)
      const data = await fetchExamToday()
      setTodayQueue(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setErrorQueue(String(detail || message || 'Erro ao carregar fila de hoje'))
    }
  }

  useEffect(() => {
    loadToday()
  }, [])

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Entrevistas do dia</Typography>
          {errorQueue && <Alert severity="error">{errorQueue}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Dia de assistência</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todayQueue.map((q) => (
                <TableRow key={`${q.user_id}:${q.cycle_id}`}>
                  <TableCell>{q.name}</TableCell>
                  <TableCell><Chip label={q.pass_type ?? ''} size="small" /></TableCell>
                  <TableCell>{q.assistance_day ?? '—'}</TableCell>
                  <TableCell>
                    {q.exam_completed
                      ? <Chip size="small" color="success" label="Concluído" />
                      : <Chip size="small" color="warning" label="Pendente" />}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      href={`/users/${q.user_id}/exam`}
                    >
                      Ficha
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {todayQueue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">Nenhum assistido presente para entrevista hoje.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Typography variant="h6">Respostas de exame</Typography>
          <TextField label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key==='Enter' && load()} />
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Próximo passe</TableCell>
                <TableCell>Tipo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell>{it.next_pass_date ?? ''}</TableCell>
                  <TableCell><Chip label={it.pass_type ?? ''} size="small" /></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">Nenhum registro.</Typography>
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

export default InterviewDashboard
