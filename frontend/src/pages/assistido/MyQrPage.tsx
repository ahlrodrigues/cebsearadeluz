import { useEffect, useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import QRCode from 'react-qr-code'
import { getMyQrToken } from '../../api/assistido'

const MyQrPage = () => {
  const [token, setToken] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const { token } = await getMyQrToken()
      setToken(token)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Erro ao carregar QR')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5" component="h1">Meu QR</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {token ? (
            <Box sx={{ p: 2, bgcolor: 'white' }}>
              <QRCode value={token} size={220} />
            </Box>
          ) : (
            <Typography>Gerando QR...</Typography>
          )}
          <Box>
            <Button variant="outlined" onClick={load}>Atualizar</Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}

export default MyQrPage

