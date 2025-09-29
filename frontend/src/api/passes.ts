import { apiClient } from './client'

export type PassSessionStatus = 'Agendado' | 'Presente' | 'Falta'
export type PassCycleStatus = 'Ativo' | 'Concluído' | 'Interrompido'

export interface PassSession {
  id: number
  cycle_id: number
  sequence_index: number
  scheduled_for: string
  status: PassSessionStatus
  notes?: string | null
  presence_recorded_at?: string | null
  created_at: string
  updated_at?: string | null
}

export interface PassCycle {
  id: number
  user_id: number
  stage_number: number
  pass_type: string
  status: PassCycleStatus
  sequence_length: number
  started_at: string
  completed_at?: string | null
  interrupted_at?: string | null
  requires_interview: boolean
  interview_scheduled_for?: string | null
  interview_completed_at?: string | null
  created_at: string
  updated_at?: string | null
  sessions: PassSession[]
}

export interface PassOccurrencePayload {
  date?: string
  notes?: string
}

export const fetchPassCycles = async (userId: number): Promise<PassCycle[]> => {
  const response = await apiClient.get<PassCycle[]>(`/users/${userId}/pass-cycles`)
  return response.data
}

export const fetchActivePassCycle = async (userId: number): Promise<PassCycle> => {
  const response = await apiClient.get<PassCycle>(`/users/${userId}/pass-cycles/active`)
  return response.data
}

export const registerPassPresence = async (
  userId: number,
  payload: PassOccurrencePayload,
): Promise<PassSession> => {
  const response = await apiClient.post<PassSession>(`/users/${userId}/passes/presence`, payload)
  return response.data
}

export const registerPassAbsence = async (
  userId: number,
  payload: PassOccurrencePayload,
): Promise<PassSession> => {
  const response = await apiClient.post<PassSession>(`/users/${userId}/passes/absence`, payload)
  return response.data
}
