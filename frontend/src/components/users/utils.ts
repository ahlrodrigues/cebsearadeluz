import type { CreateUserPayload, UserRole, UserStatus } from '../../api/users'
import type { UserFormValues } from './types'
import { DEFAULT_VALUES } from './values'

export { DEFAULT_VALUES } from './values'

export const normalizeInitialValues = (
  values?: Partial<UserFormValues>,
): UserFormValues => ({
  ...DEFAULT_VALUES,
  ...values,
  status: (values?.status ?? 'Ativo') as UserStatus,
  role: (values?.role ?? 'user') as UserRole,
  confirm_password: values?.confirm_password ?? values?.password ?? '',
})

export const mapToPayload = (values: UserFormValues): CreateUserPayload => ({
  full_name: values.full_name,
  social_name: values.social_name || undefined,
  birth_date: values.birth_date || undefined,
  cep: values.cep || undefined,
  street: values.street || undefined,
  number: values.number || undefined,
  complement: values.complement || undefined,
  neighborhood: values.neighborhood || undefined,
  city: values.city || undefined,
  state: values.state ? values.state.toUpperCase() : undefined,
  phone: values.phone || undefined,
  email: values.email || undefined,
  social_network: values.social_network || undefined,
  status: values.status,
  role: values.role,
  password: values.password,
})
