import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material'
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom'

const AppLayout = () => {
  const location = useLocation()
  const isUsersList = location.pathname === '/users'
  const isCreateUser = location.pathname === '/users/new'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CEB Seara da Luz
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              component={RouterLink}
              to="/users"
              color="inherit"
              variant={isUsersList ? 'outlined' : 'text'}
            >
              Usuários
            </Button>
            <Button
              component={RouterLink}
              to="/users/new"
              color="inherit"
              variant={isCreateUser ? 'outlined' : 'text'}
            >
              Novo cadastro
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  )
}

export default AppLayout
