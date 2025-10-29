import { useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import { forgotPassword } from '../api/auth'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setOk(null)
    setError(null)
    try {
      await forgotPassword(email)
      setOk('Se o e-mail existir no sistema, você receberá o link para redefinir a senha em instantes.')
    } catch (e: unknown) {
      const message = (e as Error)?.message
      setError(String(message || 'Falha ao solicitar redefinição'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1">Redefinir senha</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <Box>
              <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link'}</Button>
            </Box>
            <Alert severity="info">Por segurança, a troca de senha é feita apenas via link enviado por e-mail.</Alert>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

export default ForgotPassword
