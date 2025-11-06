import { useEffect, useRef, useState } from 'react'
import { Container, Paper, Stack, TextField, Button, Alert, Typography, IconButton, InputAdornment, Tooltip, CircularProgress, Divider } from '@mui/material'
import { http } from '../../api/http'
import { lookupCep } from '../../api/cep'
import SearchIcon from '@mui/icons-material/Search'
import { webauthnRegisterBegin, webauthnRegisterFinish } from '../../api/auth'
import { attestationToJSON, mapCreationOptions } from '../../auth/webauthn'

type Me = {
  id: number
  full_name: string
  social_name?: string | null
  phone?: string | null
  email?: string | null
}

const EditMyProfile = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [fullName, setFullName] = useState('')
  const [socialName, setSocialName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [socialNetwork, setSocialNetwork] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const lastCep = useRef('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [passkeyMsg, setPasskeyMsg] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const { data } = await http.get<Me>('/me')
      setMe(data)
      setFullName(data.full_name || '')
      setSocialName(data.social_name || '')
      setPhone(data.phone || '')
      setEmail(data.email || '')
      setCep((data as any).cep || '')
      setStreet((data as any).street || '')
      setNumber((data as any).number || '')
      setComplement((data as any).complement || '')
      setNeighborhood((data as any).neighborhood || '')
      setCity((data as any).city || '')
      setState((data as any).state || '')
      setSocialNetwork((data as any).social_network || '')
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Erro ao carregar perfil'))
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!me) return
    setLoading(true)
    setError(null)
    setOk(null)
    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        social_name: socialName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        cep: cep.trim() || null,
        street: street.trim() || null,
        number: number.trim() || null,
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
        social_network: socialNetwork.trim() || null,
      }
      await http.put(`/me`, payload)
      setOk('Dados atualizados com sucesso!')
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const message = (e as Error)?.message
      setError(String(detail || message || 'Falha ao salvar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1">Meu cadastro</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
            <TextField label="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
            <TextField label="Nome social" value={socialName} onChange={(e) => setSocialName(e.target.value)} fullWidth />
            <TextField label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField
              label="CEP"
              value={cep}
              onChange={(e) => { setCep(e.target.value); lastCep.current = '' }}
              onBlur={async () => {
                const digits = cep.replace(/\D/g, '')
                if (digits.length !== 8 || digits === lastCep.current) return
                try {
                  setCepLoading(true)
                  const a = await lookupCep(digits)
                  lastCep.current = digits
                  setStreet((prev) => a.street ?? prev)
                  setNeighborhood((prev) => a.neighborhood ?? prev)
                  setCity((prev) => a.city ?? prev)
                  setState((prev) => a.state ?? prev)
                } catch {
                  // ignore
                } finally {
                  setCepLoading(false)
                }
              }}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {cepLoading ? (
                      <CircularProgress size={18} />
                    ) : (
                      <Tooltip title="Buscar endereço">
                        <span>
                          <IconButton size="small" onClick={async () => {
                            const digits = cep.replace(/\D/g, '')
                            if (digits.length !== 8) return
                            try {
                              setCepLoading(true)
                              const a = await lookupCep(digits)
                              lastCep.current = digits
                              setStreet((prev) => a.street ?? prev)
                              setNeighborhood((prev) => a.neighborhood ?? prev)
                              setCity((prev) => a.city ?? prev)
                              setState((prev) => a.state ?? prev)
                            } finally {
                              setCepLoading(false)
                            }
                          }}>
                            <SearchIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </InputAdornment>
                )
              }}
            />
            <TextField label="Rua/Avenida" value={street} onChange={(e) => setStreet(e.target.value)} fullWidth />
            <TextField label="Número" value={number} onChange={(e) => setNumber(e.target.value)} fullWidth />
            <TextField label="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} fullWidth />
            <TextField label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} fullWidth />
            <TextField label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
            <TextField label="UF" value={state} onChange={(e) => setState(e.target.value)} fullWidth inputProps={{ maxLength: 2 }} />
            <TextField label="Rede social" value={socialNetwork} onChange={(e) => setSocialNetwork(e.target.value)} fullWidth />
            <Alert severity="info">Para alterar a senha, utilize a opção "Esqueci minha senha" na tela de login. Alterações de perfil/status são realizadas pela administração.</Alert>
            {import.meta.env.VITE_WEB_AUTHN_ENABLED === '1' && 'credentials' in navigator && (
              <>
                <Divider />
                <Typography variant="h6">Login por biometria (beta)</Typography>
                {passkeyMsg && <Alert severity="info">{passkeyMsg}</Alert>}
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" disabled={!me} onClick={async () => {
                    try {
                      setPasskeyMsg(null)
                      const begin = await webauthnRegisterBegin()
                      const opts = mapCreationOptions(begin.publicKey)
                      const cred = (await navigator.credentials.create({ publicKey: opts })) as PublicKeyCredential
                      await webauthnRegisterFinish({ ...attestationToJSON(cred), state: begin.state })
                      setPasskeyMsg('Biometria habilitada neste dispositivo. Você poderá usar "Entrar com biometria" na tela de login.')
                    } catch (e: any) {
                      setPasskeyMsg(String(e?.response?.data?.detail || e?.message || 'Falha ao registrar passkey'))
                    }
                  }}>Ativar login por biometria</Button>
                </Stack>
              </>
            )}
            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained" disabled={loading || !me}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

export default EditMyProfile
