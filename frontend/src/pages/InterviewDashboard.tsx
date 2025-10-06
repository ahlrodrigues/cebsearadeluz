import { useEffect, useState } from 'react'
import { Alert, Container, Paper, Stack, TextField, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material'
import { fetchCompletedInterviews, type InterviewItem } from '../api/interviews'

const InterviewDashboard = () => {
  const [items, setItems] = useState<InterviewItem[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const data = await fetchCompletedInterviews(search.trim() || undefined)
      setItems(data)
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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">Respostas de exame</Typography>
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
