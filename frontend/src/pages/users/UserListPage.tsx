import type { ChangeEvent, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { AxiosError } from 'axios'

import { fetchUsers } from '../../api/users'
import type { UserFilters, UserResponse, UserRole, UserStatus } from '../../api/users'

const statusFilterOptions: Array<{ value: 'all' | UserStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'Ativo', label: 'Ativo' },
  { value: 'Desativado', label: 'Desativado' },
]

const roleFilterOptions: Array<{ value: 'all' | UserRole; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Usuário comum' },
  { value: 'admin', label: 'Administrador' },
]

type FilterState = {
  search: string
  status: 'all' | UserStatus
  role: 'all' | UserRole
}

const FILTERS_INITIAL_STATE: FilterState = {
  search: '',
  status: 'all',
  role: 'all',
}

const mapToApiFilters = (filters: FilterState): UserFilters => ({
  search: filters.search.trim() || undefined,
  status: filters.status === 'all' ? undefined : filters.status,
  role: filters.role === 'all' ? undefined : filters.role,
})

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate))

const UserListPage = () => {
  const [filters, setFilters] = useState<FilterState>(FILTERS_INITIAL_STATE)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(FILTERS_INITIAL_STATE)

  const queryFilters = useMemo(() => mapToApiFilters(appliedFilters), [appliedFilters])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<UserResponse[], AxiosError>({
    queryKey: ['users', queryFilters],
    queryFn: () => fetchUsers(queryFilters),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const handleFilterChange = (field: keyof FilterState) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as FilterState[keyof FilterState]
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const handleSubmitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  const handleClearFilters = () => {
    setFilters(FILTERS_INITIAL_STATE)
    setAppliedFilters(FILTERS_INITIAL_STATE)
  }

  const users: UserResponse[] = data ?? []
  const apiErrorDetail = (error?.response?.data as { detail?: string } | undefined)?.detail

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        <div>
          <Typography variant="h5" component="h1">
            Usuários cadastrados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Utilize os filtros para localizar rapidamente usuários ativos, inativos ou administradores.
          </Typography>
        </div>
        <Button component={RouterLink} to="/users/new" variant="contained" disableElevation>
          Novo usuário
        </Button>
      </Stack>

      <Paper component="form" onSubmit={handleSubmitFilters} sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
          <TextField
            label="Buscar por nome"
            value={filters.search}
            onChange={handleFilterChange('search')}
            placeholder="Digite parte do nome"
            fullWidth
          />

          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={handleFilterChange('status')}
            sx={{ minWidth: { xs: '100%', md: 180 } }}
          >
            {statusFilterOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Perfil"
            value={filters.role}
            onChange={handleFilterChange('role')}
            sx={{ minWidth: { xs: '100%', md: 200 } }}
          >
            {roleFilterOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" disableElevation disabled={isFetching && !isError}>
              Aplicar filtros
            </Button>
            <Button type="button" variant="outlined" onClick={handleClearFilters} disabled={isFetching}>
              Limpar
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {isError && (
        <Alert severity="error">
          {apiErrorDetail ?? error?.message ?? 'Não foi possível carregar os usuários.'}
          <Box>
            <Link component="button" type="button" onClick={() => refetch()} sx={{ mt: 1 }}>
              Tentar novamente
            </Link>
          </Box>
        </Alert>
      )}

      <Paper>
        {isLoading || isFetching ? <LinearProgress /> : <Divider />}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Perfil</TableCell>
                <TableCell>Cadastro</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{user.full_name}</Typography>
                        {user.social_name && (
                          <Typography variant="caption" color="text.secondary">
                            Nome social: {user.social_name}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{user.email ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.status}
                        color={user.status === 'Ativo' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role === 'admin' ? 'Administrador' : 'Usuário'}
                        color={user.role === 'admin' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(user.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  )
}

export default UserListPage
