import { useMemo, useState } from 'react'
import { Box, Button, Container, Paper, Stack, TextField, Typography, Alert, Link } from '@mui/material'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AUTH_API_BASE } from '../api/auth'
import type { AxiosError } from 'axios'

const LoginPage = () => {
  const { signin, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const apiBaseHint = useMemo(() => (AUTH_API_BASE || '(proxy do Vite)'), [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const info = await signin(email, password)
      const role = info?.role
      const id = info?.userId
      if (role === 'user') navigate(`/app/assistido/qr`, { replace: true })
      else navigate('/users', { replace: true })
    } catch (err: unknown) {
      const ax = err as AxiosError<any>
      const detail = ax?.response?.data?.detail
      const message = (ax?.message || (err as Error)?.message)
      const isTimeout = ax?.code === 'ECONNABORTED' || /timeout/i.test(String(message))
      const noResponse = !ax?.response
      if (isTimeout || noResponse) {
        setError(`Não foi possível conectar ao servidor (API: ${apiBaseHint}). Verifique se o backend está ativo em http://127.0.0.1:8000 (ou o endereço LAN) e tente novamente.`)
      } else {
        setError(String(detail || message || 'Falha no login'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1">Acessar o sistema</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {!error && (
              <Alert severity="info">
                Dica: em desenvolvimento, o frontend usa {apiBaseHint} para falar com a API. Se o login não responder,
                confirme que o backend (Uvicorn) está rodando e acessível em /docs.
              </Alert>
            )}
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
            <TextField label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required />
            <Box>
              <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
            </Box>
            <Typography variant="body2">
              <Link component={RouterLink} to="/forgot-password">Esqueci minha senha</Link>
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

export default LoginPage
