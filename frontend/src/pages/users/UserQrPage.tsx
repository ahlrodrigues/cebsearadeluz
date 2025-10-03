import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import QRCode from 'react-qr-code'
import { getUser, getUserQrToken } from '../../api/users'

const UserQrPage = () => {
  const { userId } = useParams()
  const [token, setToken] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const id = Number(userId)

  const load = async () => {
    try {
      setError(null)
      const [u, t] = await Promise.all([getUser(id), getUserQrToken(id)])
      setName(u.social_name || u.full_name)
      setToken(t.token)
    } catch (e: unknown) {
      const responseDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(responseDetail || message || 'Erro'))
    }
  }

  useEffect(() => {
    if (Number.isFinite(id)) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5">QR do Assistido</Typography>
          <Typography variant="body2" color="text.secondary">{name}</Typography>
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
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>
    </Container>
  )
}

export default UserQrPage
