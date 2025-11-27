import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { fetchExamQueue, type ExamQueueItem } from '../api/exam_ops'
import type { AssistanceDay } from '../api/users'
import { Link as RouterLink } from 'react-router-dom'

const ExamsPage = () => {
  const [items, setItems] = useState<ExamQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<AssistanceDay | 'all'>('all')

  const assistanceDays: AssistanceDay[] = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo',
  ]

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchExamQueue()
      setItems(Array.isArray(data) ? data : [])
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

    const intervalId = window.setInterval(() => {
      load()
    }, 5 * 60 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const filteredItems = selectedDay === 'all'
    ? items
    : items.filter((it) => it.assistance_day === selectedDay)

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Exames</Typography>
          <Typography color="text.secondary">
            Lista de assistidos que concluíram o ciclo com sucesso (4 presenças e no máximo 2 ausências) e aguardam entrevista/exame.
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
            <Button variant="outlined" onClick={load} disabled={loading}>Atualizar</Button>
            <Button variant="outlined" onClick={() => window.print()}>Imprimir</Button>
            <TextField
              select
              size="small"
              label="Dia de assistência"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value as AssistanceDay | 'all')}
              sx={{ minWidth: 200, ml: { xs: 0, sm: 'auto' } }}
            >
              <MenuItem value="all">Todos</MenuItem>
              {assistanceDays.map((day) => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {actionError && <Alert severity="warning">{actionError}</Alert>}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Dia de assistência</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((it) => (
                <TableRow key={`${it.user_id}:${it.cycle_id}`}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell>{it.pass_type ?? ''}</TableCell>
                  <TableCell>{it.assistance_day ?? '—'}</TableCell>
                  <TableCell>
                    {it.exam_completed
                      ? <Chip size="small" color="success" label="Concluído" />
                      : <Chip size="small" color="warning" label="Pendente" />}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" component={RouterLink} to={`/users/${it.user_id}/exam`}>Ficha</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
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
