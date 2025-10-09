import { useState } from 'react'
import { Box, Button, Container, Paper, Stack, TextField, Typography, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const LoginPage = () => {
  const { signin, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (err as Error)?.message
      setError(String(detail || message || 'Falha no login'))
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
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
            <TextField label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required />
            <Box>
              <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

export default LoginPage
