import { useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import { publicRegister } from '../../api/assistido'
import { useNavigate } from 'react-router-dom'

const SignupPage = () => {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      const res = await publicRegister({ full_name: fullName, email, password })
      setOk(
        res.status === 'Desativado'
          ? 'Cadastro recebido. Aguarde aprovação.'
          : 'Cadastro criado! Você já pode fazer login.'
      )
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (err as Error)?.message
      setError(String(detail || message || 'Falha no cadastro'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1">Criar conta</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
            <TextField label="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <TextField label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <Box>
              <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Enviando...' : 'Cadastrar'}</Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

export default SignupPage
