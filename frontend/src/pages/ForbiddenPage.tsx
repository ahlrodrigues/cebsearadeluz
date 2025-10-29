import { Button, Container, Paper, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

const ForbiddenPage = () => {
  const navigate = useNavigate()
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5">Acesso não autorizado</Typography>
          <Typography>Você não tem permissão para acessar esta página.</Typography>
          <Button variant="contained" onClick={() => navigate('/', { replace: true })}>Ir para início</Button>
        </Stack>
      </Paper>
    </Container>
  )
}

export default ForbiddenPage

