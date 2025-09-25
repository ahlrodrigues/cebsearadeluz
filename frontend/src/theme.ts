import { createTheme } from '@mui/material/styles'

const palettePrimary = '#1976d2'
const paletteSecondary = '#9c27b0'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: palettePrimary },
    secondary: { main: paletteSecondary },
    background: {
      default: '#f5f7fa',
    },
  },
  shape: {
    borderRadius: 10,
  },
})
