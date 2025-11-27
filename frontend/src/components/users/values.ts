import type { UserFormValues } from './types'

export const DEFAULT_VALUES: UserFormValues = {
  full_name: '',
  social_name: '',
  birth_date: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  social_network: '',
  status: 'Ativo',
  role: 'user',
  extra_roles: [],
  assistance_day: '',
  digital_login_enabled: true,
  password: '',
  confirm_password: '',
}
