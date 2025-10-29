import { useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { reserveTickets } from '../api/tickets'

const passTypes = ['P1','P2','P3A','P3B','CH','P4A','P4B']

const TicketsPage = () => {
  const [count, setCount] = useState(1)
  const [passType, setPassType] = useState<string>('P1')
  const [busy, setBusy] = useState(false)
  const [reserved, setReserved] = useState<{ ticket_number: number; pass_type?: string|null }[] | null>(null)

  const canPrint = useMemo(() => reserved && reserved.length > 0, [reserved])

  const onReserve = async () => {
    try {
      setBusy(true)
      const items = await reserveTickets({ count, pass_type: passType })
      setReserved(items)
      // abre diálogo de impressão após renderizar
      setTimeout(() => window.print(), 0)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box display="flex" justifyContent="center" mt={2}>
      <Card sx={{ maxWidth: 560, width: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Imprimir senhas avulsas</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Tipo de passe</InputLabel>
              <Select label="Tipo de passe" value={passType} onChange={(e) => setPassType(String(e.target.value))}>
                {passTypes.map((t) => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField
              type="number"
              label="Quantidade"
              inputProps={{ min: 1, max: 20 }}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
            <Button variant="contained" disableElevation disabled={busy} onClick={onReserve}>
              {busy ? 'Gerando...' : 'Imprimir'}
            </Button>
          </Stack>

          {canPrint && (
            <Box mt={3} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 2 }}>
              {reserved!.map((r) => (
                <Box key={r.ticket_number} sx={{ border: '1px dashed', p: 2, textAlign: 'center' }}>
                  <Typography variant="overline" display="block">Senha</Typography>
                  <Typography variant="h4" fontWeight={700}>{r.ticket_number}</Typography>
                  <Typography variant="body2" color="text.secondary">{passType}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default TicketsPage

