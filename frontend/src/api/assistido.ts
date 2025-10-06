import { apiClient } from './client'
import type { PassCycle } from './passes'

export interface PublicRegisterPayload {
  full_name: string
  email: string
  password: string
}

export interface PublicRegisterResponse {
  id: number
  status: 'Ativo' | 'Desativado'
  role: 'user' | 'interviewer' | 'admin'
}

export const publicRegister = async (
  payload: PublicRegisterPayload,
): Promise<PublicRegisterResponse> => {
  const { data } = await apiClient.post<PublicRegisterResponse>(
    '/public/register',
    payload,
  )
  return data
}

export const getMyQrToken = async (): Promise<{ token: string }> => {
  const { data } = await apiClient.get<{ token: string }>(`/me/qr-token`)
  return data
}

export const fetchMyPassCycles = async (): Promise<PassCycle[]> => {
  const { data } = await apiClient.get<PassCycle[]>(`/me/pass-cycles`)
  return data
}

export const fetchMyActivePassCycle = async (): Promise<PassCycle> => {
  const { data } = await apiClient.get<PassCycle>(`/me/pass-cycles/active`)
  return data
}

