import { useMemo, useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') || '', [params])
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (!token) return setError('Link inválido ou expirado.')
    if (pwd.length < 8) return setError('A senha deve ter ao menos 8 caracteres.')
    if (pwd !== pwd2) return setError('As senhas não coincidem.')
    setLoading(true)
    try {
      await resetPassword(token, pwd)
      setOk('Senha redefinida com sucesso. Você já pode fazer login.')
      setTimeout(() => navigate('/login', { replace: true }), 1000)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Não foi possível redefinir a senha.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1">Definir nova senha</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
            <TextField label="Nova senha" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required fullWidth />
            <TextField label="Confirmar senha" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required fullWidth />
            <Box>
              <Button type="submit" variant="contained" disabled={loading || !token}>{loading ? 'Salvando...' : 'Redefinir senha'}</Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

export default ResetPassword

