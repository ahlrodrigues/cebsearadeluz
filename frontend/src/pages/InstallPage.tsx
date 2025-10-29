import { Box, Button, Card, CardContent, List, ListItem, ListItemText, Typography } from '@mui/material'
import InstallPwaButton from '../components/InstallPwaButton'
import { Link } from 'react-router-dom'

const InstallPage = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)

  return (
    <Box display="flex" justifyContent="center" alignItems="flex-start" mt={4}>
      <Card sx={{ maxWidth: 560, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Instalar aplicativo no celular
          </Typography>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            A instalação cria um atalho na tela inicial e abre o sistema em modo aplicativo (PWA).
          </Typography>

          <Box my={2}>
            <InstallPwaButton />
          </Box>

          {isAndroid && (
            <>
              <Typography variant="subtitle1">Android (Chrome)</Typography>
              <List dense>
                <ListItem><ListItemText primary="Abra o menu (⋮)" /></ListItem>
                <ListItem><ListItemText primary="Toque em 'Adicionar à tela inicial'" /></ListItem>
                <ListItem><ListItemText primary="Confirme 'Instalar'" /></ListItem>
              </List>
            </>
          )}

          {isIOS && (
            <>
              <Typography variant="subtitle1">iPhone/iPad (Safari)</Typography>
              <List dense>
                <ListItem><ListItemText primary="Toque em Compartilhar (quadrado com seta)" /></ListItem>
                <ListItem><ListItemText primary="Escolha 'Adicionar à Tela de Início'" /></ListItem>
                <ListItem><ListItemText primary="Toque em 'Adicionar'" /></ListItem>
              </List>
            </>
          )}

          <Box mt={2}>
            <Typography variant="subtitle1">Acesso rápido ao seu QR</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Depois de instalar e fazer login, você encontra o seu QR em "Meu QR".
            </Typography>
            <Button component={Link} to="/app/assistido/qr" variant="outlined">Abrir Meu QR</Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default InstallPage

