import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import InstallPwaButton from '../InstallPwaButton'

const AppLayout = () => {
  const location = useLocation()
  const isUsersList = location.pathname === '/users'
  const isCreateUser = location.pathname === '/users/new'
  const isKiosk = location.pathname === '/kiosk'
  const isReports = location.pathname.startsWith('/reports')
  const { session, signout } = useAuth()
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CEB Seara da Luz
          </Typography>
          <Stack direction="row" spacing={1}>
            {!session && (
              <>
                <Button component={RouterLink} to="/signup" color="inherit">Novo cadastro</Button>
                <InstallPwaButton />
                <Button component={RouterLink} to="/login" color="inherit">Entrar</Button>
              </>
            )}
            {session?.role === 'admin' && (
              <>
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
              </>
            )}
            {(session?.role === 'recepcao' || session?.role === 'admin') && (
              <Button
                component={RouterLink}
                to="/kiosk"
                color="inherit"
                variant={isKiosk ? 'outlined' : 'text'}
                startIcon={<QrCodeScannerIcon />}
              >
                Presenças
              </Button>
            )}
            {(session?.role === 'recepcao' || session?.role === 'admin') && (
              <Button component={RouterLink} to="/tickets" color="inherit">Senhas</Button>
            )}
            {session?.role === 'admin' && (
              <>
                <Button
                  component={RouterLink}
                  to="/reports/scans"
                  color="inherit"
                  variant={isReports ? 'outlined' : 'text'}
                  startIcon={<AssessmentIcon />}
                >
                  Relatórios
                </Button>
                <Button component={RouterLink} to="/reports/daily-status" color="inherit">Status do dia</Button>
              </>
            )}
            {session?.role === 'user' && (
              <>
                <Button component={RouterLink} to="/app/assistido/qr" color="inherit">Meu QR</Button>
                <Button component={RouterLink} to="/app/assistido/passes" color="inherit">Meus passes</Button>
                <Button component={RouterLink} to="/app/assistido/profile" color="inherit">Meu cadastro</Button>
              </>
            )}
            {/* Botão de instalar PWA já aparece no bloco inicial antes do login */}
            {(session?.role === 'entrevista' || session?.role === 'admin') && (
              <Button component={RouterLink} to="/interviews" color="inherit">Entrevistas</Button>
            )}
            {session && (
              <Button color="inherit" onClick={() => { signout(); navigate('/login'); }}>Sair</Button>
            )}
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
