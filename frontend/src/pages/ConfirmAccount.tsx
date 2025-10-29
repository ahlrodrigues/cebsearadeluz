import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Container, Paper, Stack, Typography } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'

const ConfirmAccount = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') || '', [params])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const confirm = async () => {
    try {
      setError(null)
      setOk(null)
      await authApi.post('/auth/confirm', { token })
      setOk('Cadastro confirmado com sucesso! Você já pode fazer login.')
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Falha ao confirmar cadastro'))
    }
  }

  useEffect(() => { if (token) confirm() }, [token])

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Confirmação de cadastro</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {ok && <Alert severity="success">{ok}</Alert>}
          <Button variant="contained" onClick={() => navigate('/login', { replace: true })}>Ir para o login</Button>
        </Stack>
      </Paper>
    </Container>
  )
}

export default ConfirmAccount

