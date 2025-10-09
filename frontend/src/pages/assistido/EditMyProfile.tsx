import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import { Container, Paper, Typography } from '@mui/material'

const EditMyProfile = () => {
  const navigate = useNavigate()
  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await http.get<{ id: number }>(`/me`)
        if (data?.id) navigate(`/users/${data.id}/edit`, { replace: true })
      } catch {
        // ignore; keep message
      }
    }
    run()
  }, [navigate])

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography>Abrindo meu cadastro...</Typography>
      </Paper>
    </Container>
  )
}

export default EditMyProfile

