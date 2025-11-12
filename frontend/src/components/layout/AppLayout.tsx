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
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')
  const logoUrl = `${base}/icons/app-icon.svg`

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={1}>
        {/* Linha 1: logo + nome */}
        <Toolbar sx={{ minHeight: 56, py: 0.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box component="img" src={logoUrl} alt="CEB Seara de Luz" sx={{ width: 28, height: 28 }} />
            <Typography
              variant="h6"
              component="div"
              sx={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 600,
              }}
            >
              CEB Seara de Luz
            </Typography>
          </Stack>
        </Toolbar>

        {/* Linha 2: links de navegação (empilha e quebra no mobile) */}
        <Toolbar variant="dense" sx={{ pt: 0, pb: 1 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              width: '100%',
              alignItems: 'center',
              '& .MuiButton-root': { minHeight: 30, padding: '2px 10px' },
            }}
          >
            {!session && (
              <>
                <Button size="small" component={RouterLink} to="/signup" color="inherit">Novo cadastro</Button>
                <InstallPwaButton />
                <Button size="small" component={RouterLink} to="/login" color="inherit">Entrar</Button>
              </>
            )}

            {session?.role === 'admin' && (
              <>
                <Button
                  size="small"
                  component={RouterLink}
                  to="/users"
                  color="inherit"
                  variant={isUsersList ? 'outlined' : 'text'}
                >
                  Assistidos
                </Button>
                <Button
                  size="small"
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
                size="small"
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
              <Button size="small" component={RouterLink} to="/tickets" color="inherit">Senhas</Button>
            )}

            {session?.role === 'admin' && (
              <>
                <Button
                  size="small"
                  component={RouterLink}
                  to="/reports/scans"
                  color="inherit"
                  variant={isReports ? 'outlined' : 'text'}
                  startIcon={<AssessmentIcon />}
                >
                  Relatórios
                </Button>
                <Button size="small" component={RouterLink} to="/reports/daily-status" color="inherit">Status do dia</Button>
              </>
            )}

            {session?.role === 'user' && (
              <>
                <Button size="small" component={RouterLink} to="/app/assistido/qr" color="inherit">Meu QR</Button>
                <Button size="small" component={RouterLink} to="/app/assistido/passes" color="inherit">Meus passes</Button>
                <Button size="small" component={RouterLink} to="/app/assistido/profile" color="inherit">Meu cadastro</Button>
              </>
            )}

            {(session?.role === 'entrevista' || session?.role === 'admin') && (
              <Button size="small" component={RouterLink} to="/interviews" color="inherit">Entrevistas</Button>
            )}

            {session && (
              <Button size="small" sx={{ ml: 'auto' }} color="inherit" onClick={() => { signout(); navigate('/login'); }}>Sair</Button>
            )}
          </Box>
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
