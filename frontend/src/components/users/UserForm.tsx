import type { ChangeEvent, FormEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import Snackbar from '@mui/material/Snackbar'
import Paper from '@mui/material/Paper'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { AxiosError } from 'axios'

import type { CreateUserPayload, UserRole, UserStatus } from '../../api/users'
import { lookupCep } from '../../api/cep'
import { mapToPayload, normalizeInitialValues } from './utils'

export type UserFormMode = 'create' | 'edit'

export interface UserFormValues {
  full_name: string
  social_name: string
  birth_date: string
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  phone: string
  email: string
  social_network: string
  status: UserStatus
  role: UserRole
  password: string
  confirm_password: string
}

const statusOptions: Array<UserStatus> = ['Ativo', 'Desativado']
const roleOptions: Array<UserRole> = ['user', 'admin']

export interface UserFormProps {
  mode: UserFormMode
  initialValues?: Partial<UserFormValues>
  title?: string
  subtitle?: string
  submitLabel?: string
  successMessage?: string
  isSubmitting?: boolean
  error?: AxiosError | Error | null
  onSubmit: (values: CreateUserPayload) => Promise<void> | void
  onReset?: () => void
}

const UserForm = ({
  mode,
  initialValues,
  title,
  subtitle,
  submitLabel,
  successMessage,
  isSubmitting = false,
  error,
  onSubmit,
  onReset,
}: UserFormProps) => {
  const normalizedInitial = useMemo(() => normalizeInitialValues(initialValues), [initialValues])

  const [values, setValues] = useState<UserFormValues>(normalizedInitial)
  const [formErrors, setFormErrors] = useState<{ password?: string; email?: string }>({})
  const [isSnackbarOpen, setSnackbarOpen] = useState(false)
  const [isCepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const lastFetchedCep = useRef<string>('')

  const handleSnackbarClose = () => setSnackbarOpen(false)

  const handleChange = (field: keyof UserFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'cep') {
      setCepError(null)
      lastFetchedCep.current = ''
    }
    if (field === 'email') {
      setFormErrors((current) => ({ ...current, email: undefined }))
    }
    if (field === 'password' || field === 'confirm_password') {
      setFormErrors((current) => ({ ...current, password: undefined }))
    }
  }

  const handleCepLookup = async () => {
    const sanitized = values.cep.replace(/\D/g, '')
    if (sanitized.length === 0) {
      setCepError(null)
      return
    }
    if (sanitized.length !== 8) {
      setCepError('Informe um CEP com 8 dígitos.')
      return
    }
    if (sanitized === lastFetchedCep.current) {
      return
    }

    try {
      setCepLoading(true)
      setCepError(null)
      const address = await lookupCep(sanitized)
      lastFetchedCep.current = sanitized
      setValues((current) => ({
        ...current,
        street: address.street ?? current.street,
        neighborhood: address.neighborhood ?? current.neighborhood,
        city: address.city ?? current.city,
        state: address.state ?? current.state,
      }))
    } catch (lookupError) {
      lastFetchedCep.current = ''
      if (lookupError instanceof Error) {
        setCepError(lookupError.message)
      } else {
        setCepError('Não foi possível buscar o CEP informado.')
      }
    } finally {
      setCepLoading(false)
    }
  }

  const internalReset = () => {
    setValues(normalizedInitial)
    setFormErrors({})
    setShowPassword(false)
    setShowConfirmPassword(false)
    setCepError(null)
    lastFetchedCep.current = ''
    setSnackbarOpen(false)
    onReset?.()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (values.password !== values.confirm_password) {
      setFormErrors((current) => ({ ...current, password: 'As senhas não coincidem.' }))
      return
    }

    if (values.email.trim() && !values.email.includes('@')) {
      setFormErrors((current) => ({ ...current, email: 'E-mail inválido.' }))
      return
    }

    try {
      await onSubmit(mapToPayload(values))
      setSnackbarOpen(true)
      if (mode === 'create') {
        internalReset()
      }
    } catch (submitError) {
      console.error(submitError)
    }
  }

  const errorMessage = (() => {
    if (!error) return ''
    if ('response' in error && error.response) {
      return (
        (error.response.data as { detail?: string })?.detail || error.message || 'Erro ao processar o formulário.'
      )
    }
    return error.message
  })()

  const fullRow = { xs: 'span 1', md: 'span 2' } as const

  const resolvedTitle =
    title ?? (mode === 'create' ? 'Cadastro de usuário' : 'Atualização de usuário')
  const resolvedSubtitle =
    subtitle ??
    'Informe os dados obrigatórios e, se desejar, complete com as informações opcionais.'
  const resolvedSubmitLabel = submitLabel ?? (mode === 'create' ? 'Salvar usuário' : 'Salvar alterações')
  const resolvedSuccessMessage = successMessage ??
    (mode === 'create' ? 'Usuário cadastrado com sucesso!' : 'Dados atualizados com sucesso!')

  return (
    <>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {resolvedTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {resolvedSubtitle}
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMessage}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <TextField
              label="Nome completo"
              value={values.full_name}
              onChange={handleChange('full_name')}
              required
              fullWidth
              sx={{ gridColumn: fullRow }}
            />

            <TextField
              label="Nome social"
              value={values.social_name}
              onChange={handleChange('social_name')}
              fullWidth
            />

            <TextField
              label="Data de nascimento"
              type="date"
              value={values.birth_date}
              onChange={handleChange('birth_date')}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="CEP"
              value={values.cep}
              onChange={handleChange('cep')}
              onBlur={handleCepLookup}
              error={Boolean(cepError)}
              helperText={cepError ?? ' '}
              fullWidth
              inputProps={{ inputMode: 'numeric', pattern: '\\d{5}-?\\d{3}' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {isCepLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Tooltip title="Buscar endereço">
                        <span>
                          <IconButton
                            aria-label="Buscar endereço"
                            edge="end"
                            onClick={handleCepLookup}
                            disabled={values.cep.replace(/\D/g, '').length !== 8}
                          >
                            <SearchIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Rua/Avenida"
              value={values.street}
              onChange={handleChange('street')}
              fullWidth
            />

            <TextField
              label="Número"
              value={values.number}
              onChange={handleChange('number')}
              fullWidth
            />

            <TextField
              label="Complemento"
              value={values.complement}
              onChange={handleChange('complement')}
              fullWidth
            />

            <TextField
              label="Bairro"
              value={values.neighborhood}
              onChange={handleChange('neighborhood')}
              fullWidth
            />

            <TextField
              label="Cidade"
              value={values.city}
              onChange={handleChange('city')}
              fullWidth
            />

            <TextField
              label="Estado"
              value={values.state}
              onChange={handleChange('state')}
              fullWidth
              inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
            />

            <TextField
              label="Telefone"
              value={values.phone}
              onChange={handleChange('phone')}
              fullWidth
              sx={{ gridColumn: fullRow }}
              placeholder="(11)98765-4321"
              inputProps={{
                inputMode: 'tel',
                pattern: '(\\d{10,11}|(\\(\\d{2}\\)\\s?)?\\d{4,5}-?\\d{4})',
              }}
            />

            <TextField
              label="E-mail"
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              fullWidth
              error={Boolean(formErrors.email)}
              helperText={formErrors.email ?? ' '}
            />

            <TextField
              label="Rede social"
              value={values.social_network}
              onChange={handleChange('social_network')}
              fullWidth
            />

            <TextField
              label="Status"
              select
              value={values.status}
              onChange={handleChange('status')}
              required
              fullWidth
            >
              {statusOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Perfil"
              select
              value={values.role}
              onChange={handleChange('role')}
              required
              fullWidth
            >
              {roleOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option === 'user' ? 'Usuário comum' : 'Administrador'}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              value={values.password}
              onChange={handleChange('password')}
              required
              fullWidth
              sx={{ gridColumn: fullRow }}
              helperText="A senha precisa ter pelo menos 8 caracteres."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Alternar exibição da senha"
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirmar senha"
              type={showConfirmPassword ? 'text' : 'password'}
              value={values.confirm_password}
              onChange={handleChange('confirm_password')}
              required
              fullWidth
              sx={{ gridColumn: fullRow }}
              error={Boolean(formErrors.password)}
              helperText={formErrors.password ?? 'Repita a senha para confirmação.'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Alternar exibição da confirmação"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={2}>
            <Button
              type="button"
              variant="outlined"
              onClick={internalReset}
              disabled={isSubmitting}
            >
              {mode === 'create' ? 'Limpar' : 'Restaurar valores'}
            </Button>
            <Button type="submit" variant="contained" disableElevation disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : resolvedSubmitLabel}
            </Button>
          </Stack>
        </Box>
      </Paper>

      <Snackbar
        open={isSnackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" variant="filled" sx={{ width: '100%' }}>
          {resolvedSuccessMessage}
        </Alert>
      </Snackbar>
    </>
  )
}

export default UserForm
