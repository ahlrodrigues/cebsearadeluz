import { apiClient } from './client'

export interface ExamQueueItem {
  user_id: number
  name: string
  cycle_id: number
  pass_type?: string | null
  scheduled_for?: string | null
}

export const fetchExamQueue = async (): Promise<ExamQueueItem[]> => {
  const { data } = await apiClient.get<ExamQueueItem[]>(`/exams/queue`)
  return data
}

export const scheduleExam = async (
  userId: number,
  date: string,
) => {
  const { data } = await apiClient.put(`/exams/${userId}/schedule`, { date })
  return data
}

export const completeExam = async (userId: number) => {
  const { data } = await apiClient.post(`/exams/${userId}/complete`)
  return data
}

