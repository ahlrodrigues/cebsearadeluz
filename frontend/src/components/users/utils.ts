import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserRole,
  UserStatus,
  UserResponse,
  AssistanceDay,
} from '../../api/users'
import type { UserFormValues } from './types'
import { DEFAULT_VALUES } from './values'

export { DEFAULT_VALUES } from './values'

const optional = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export const normalizeInitialValues = (
  values?: Partial<UserFormValues>,
): UserFormValues => ({
  ...DEFAULT_VALUES,
  ...values,
  status: (values?.status ?? 'Ativo') as UserStatus,
  role: (values?.role ?? 'user') as UserRole,
  confirm_password: values?.confirm_password ?? values?.password ?? '',
  assistance_day: values?.assistance_day ?? '',
})

export const mapToCreatePayload = (values: UserFormValues): CreateUserPayload => ({
  full_name: values.full_name.trim(),
  social_name: optional(values.social_name),
  birth_date: optional(values.birth_date),
  cep: optional(values.cep),
  street: optional(values.street),
  number: optional(values.number),
  complement: optional(values.complement),
  neighborhood: optional(values.neighborhood),
  city: optional(values.city),
  state: optional(values.state)?.toUpperCase(),
  phone: optional(values.phone),
  email: optional(values.email),
  social_network: optional(values.social_network),
  status: values.status,
  role: values.role,
  assistance_day: optional(values.assistance_day) as AssistanceDay | undefined,
  password: values.password,
})

export const mapToUpdatePayload = (values: UserFormValues): UpdateUserPayload => {
  const trimmedFullName = values.full_name.trim()

  const payload: UpdateUserPayload = {
    full_name: trimmedFullName.length > 0 ? trimmedFullName : undefined,
    social_name: optional(values.social_name),
    birth_date: optional(values.birth_date),
    cep: optional(values.cep),
    street: optional(values.street),
    number: optional(values.number),
    complement: optional(values.complement),
    neighborhood: optional(values.neighborhood),
    city: optional(values.city),
    state: optional(values.state)?.toUpperCase(),
    phone: optional(values.phone),
    email: optional(values.email),
    social_network: optional(values.social_network),
    status: values.status,
    role: values.role,
  }

  if (values.password.trim().length > 0) {
    payload.password = values.password
  }

  if (values.assistance_day.trim().length === 0) {
    payload.assistance_day = null
  } else {
    payload.assistance_day = values.assistance_day as AssistanceDay
  }

  return payload
}

export const mapUserResponseToFormValues = (user: UserResponse): Partial<UserFormValues> => ({
  full_name: user.full_name ?? '',
  social_name: user.social_name ?? '',
  birth_date: user.birth_date ?? '',
  cep: user.cep ?? '',
  street: user.street ?? '',
  number: user.number ?? '',
  complement: user.complement ?? '',
  neighborhood: user.neighborhood ?? '',
  city: user.city ?? '',
  state: user.state ?? '',
  phone: user.phone ?? '',
  email: user.email ?? '',
  social_network: user.social_network ?? '',
  status: user.status,
  role: user.role,
  assistance_day: user.assistance_day ?? '',
  password: '',
  confirm_password: '',
})
