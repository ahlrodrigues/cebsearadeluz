import type { UserRole, UserStatus } from '../../api/users'

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
  assistance_day: string
  digital_login_enabled: boolean
  password: string
  confirm_password: string
}
