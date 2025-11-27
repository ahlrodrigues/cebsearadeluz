import { http } from './http'
import type { AssistanceDay } from './users'

export interface ExamQueueItem {
  user_id: number
  name: string
  cycle_id: number
  pass_type?: string | null
  scheduled_for?: string | null
  exam_completed?: boolean
   assistance_day?: AssistanceDay | null
}

export const fetchExamQueue = async (): Promise<ExamQueueItem[]> => {
  const { data } = await http.get<ExamQueueItem[]>(`/exams/queue`)
  return data
}

export const fetchExamToday = async (): Promise<ExamQueueItem[]> => {
  const { data } = await http.get<ExamQueueItem[]>(`/exams/today`)
  return data
}
