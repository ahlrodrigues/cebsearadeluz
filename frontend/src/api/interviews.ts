import { http } from './http'

export interface InterviewItem {
  id: number
  name: string
  next_pass_date?: string | null
  pass_type?: string | null
}

export const fetchCompletedInterviews = async (
  search?: string,
): Promise<InterviewItem[]> => {
  const params: Record<string, string> = {}
  if (search) params.search = search
  const { data } = await http.get<InterviewItem[]>(
    '/interviews/completed',
    { params },
  )
  return data
}
