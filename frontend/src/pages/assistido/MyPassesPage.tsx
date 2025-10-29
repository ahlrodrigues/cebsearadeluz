import { useEffect, useState } from 'react'
import { Alert, Container, Paper, Stack, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material'
import { fetchMyPassCycles } from '../../api/assistido'
import type { PassCycle, PassSession } from '../../api/passes'

const MyPassesPage = () => {
  const [cycles, setCycles] = useState<PassCycle[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const data = await fetchMyPassCycles()
      setCycles(data)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Erro ao carregar passes'))
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Meus passes</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {(Array.isArray(cycles) ? cycles : []).map((c) => (
            <Paper key={c.id} sx={{ p: 2 }}>
              <Typography variant="subtitle1">Ciclo {c.stage_number} • {c.pass_type} • {c.status}</Typography>
              <Typography variant="body2" color="text.secondary">
                Início: {c.started_at || '-'}{c.completed_at ? ` • Concluído: ${c.completed_at}` : ''}
              </Typography>
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Obs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(c.sessions ?? []).map((s: PassSession) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.sequence_index}</TableCell>
                      <TableCell>{s.scheduled_for}</TableCell>
                      <TableCell>
                        <Chip label={s.status} color={s.status === 'Presente' ? 'success' : 'default'} size="small" />
                      </TableCell>
                      <TableCell>{s.notes ?? ''}</TableCell>
                    </TableRow>
                  ))}
                  {c.sessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}><Typography color="text.secondary">Sem sessões registradas</Typography></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          ))}
          {cycles.length === 0 && !error && (
            <Typography color="text.secondary">Nenhum ciclo encontrado.</Typography>
          )}
        </Stack>
      </Paper>
    </Container>
  )
}

export default MyPassesPage
