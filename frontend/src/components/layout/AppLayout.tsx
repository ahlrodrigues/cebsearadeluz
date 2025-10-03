import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom'

const AppLayout = () => {
  const location = useLocation()
  const isUsersList = location.pathname === '/users'
  const isCreateUser = location.pathname === '/users/new'
  const isKiosk = location.pathname === '/kiosk'
  const isReports = location.pathname.startsWith('/reports')

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
              Assistidos
            </Button>
            <Button
              component={RouterLink}
              to="/users/new"
              color="inherit"
              variant={isCreateUser ? 'outlined' : 'text'}
            >
              Novo cadastro
            </Button>
            <Button
              component={RouterLink}
              to="/kiosk"
              color="inherit"
              variant={isKiosk ? 'outlined' : 'text'}
              startIcon={<QrCodeScannerIcon />}
            >
              Presenças
            </Button>
            <Button
              component={RouterLink}
              to="/reports/scans"
              color="inherit"
              variant={isReports ? 'outlined' : 'text'}
              startIcon={<AssessmentIcon />}
            >
              Relatórios
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container
        component="main"
        maxWidth="lg"
        sx={{
          py: 4,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: '100%' }}>
          <Outlet />
        </Box>
      </Container>
    </Box>
  )
}

export default AppLayout
