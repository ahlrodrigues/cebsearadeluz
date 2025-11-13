import { http } from './http'

export interface ExamQueueItem {
  user_id: number
  name: string
  cycle_id: number
  pass_type?: string | null
  scheduled_for?: string | null
}

export const fetchExamQueue = async (): Promise<ExamQueueItem[]> => {
  const { data } = await http.get<ExamQueueItem[]>(`/exams/queue`)
  return data
}

export const scheduleExam = async (
  userId: number,
  date: string,
) => {
  const { data } = await http.put(`/exams/${userId}/schedule`, { date })
  return data
}

export const completeExam = async (userId: number) => {
  const { data } = await http.post(`/exams/${userId}/complete`)
  return data
}

export const fetchExamToday = async (): Promise<ExamQueueItem[]> => {
  const { data } = await http.get<ExamQueueItem[]>(`/exams/today`)
  return data
}
