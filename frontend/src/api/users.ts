import { apiClient } from './client'

export type UserStatus = 'Ativo' | 'Desativado'
export type UserRole = 'user' | 'admin'

export interface CreateUserPayload {
  full_name: string
  password: string
  social_name?: string
  birth_date?: string
  cep?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  phone?: string
  email?: string
  social_network?: string
  status: UserStatus
  role: UserRole
}

export interface UserResponse extends CreateUserPayload {
  id: number
  created_at: string
  updated_at?: string | null
}

export interface UserFilters {
  search?: string
  status?: UserStatus
  role?: UserRole
  skip?: number
  limit?: number
}

const cleanPayload = (payload: CreateUserPayload): CreateUserPayload => {
  const normalize = (value?: string) => {
    if (value == null) return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }

  const result: CreateUserPayload = {
    full_name: payload.full_name.trim(),
    password: payload.password.trim(),
    status: payload.status,
    role: payload.role,
  }

  const assign = <K extends keyof CreateUserPayload>(
    key: K,
    value?: string,
    transform?: (input: string) => string,
  ) => {
    const normalized = normalize(value)
    if (normalized !== undefined) {
      result[key] = (transform ? transform(normalized) : normalized) as CreateUserPayload[K]
    }
  }

  assign('social_name', payload.social_name)
  assign('birth_date', payload.birth_date)
  assign('cep', payload.cep)
  assign('street', payload.street)
  assign('number', payload.number)
  assign('complement', payload.complement)
  assign('neighborhood', payload.neighborhood)
  assign('city', payload.city)
  assign('state', payload.state, (value) => value.toUpperCase())
  assign('phone', payload.phone)
  assign('email', payload.email)
  assign('social_network', payload.social_network)

  return result
}

export const createUser = async (payload: CreateUserPayload): Promise<UserResponse> => {
  const response = await apiClient.post<UserResponse>('/users', cleanPayload(payload))
  return response.data
}

export const fetchUsers = async (filters: UserFilters = {}): Promise<UserResponse[]> => {
  const params: Record<string, string | number> = {}

  if (filters.search) {
    params.search = filters.search
  }
  if (filters.status) {
    params.status = filters.status
  }
  if (filters.role) {
    params.role = filters.role
  }
  if (typeof filters.skip === 'number') {
    params.skip = filters.skip
  }
  if (typeof filters.limit === 'number') {
    params.limit = filters.limit
  }

  const response = await apiClient.get<UserResponse[]>('/users', { params })
  return response.data
}
