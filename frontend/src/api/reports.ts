import { apiClient } from './client'

export interface ScanLog {
  id: number;
  created_at: string;
  raw?: string | null;
  token_type?: string | null;
  scanned_for?: string | null;
  ticket_number?: number | null;
  ok: boolean;
  error?: string | null;
  user_id?: number | null;
  session_id?: number | null;
  user_name?: string | null;
}

export const fetchScanLogs = async (
  date?: string,
): Promise<ScanLog[]> => {
  const params: Record<string, string> = {}
  if (date) params.date_ref = date
  const res = await apiClient.get<ScanLog[]>(`/reports/scan-logs`, { params })
  return res.data
}

export interface ScanLogsSummary {
  date_ref: string;
  total: number;
  success: number;
  failure: number;
}

export const fetchScanLogsSummary = async (
  date: string,
): Promise<ScanLogsSummary> => {
  const res = await apiClient.get<ScanLogsSummary>(
    `/reports/scan-logs/summary`,
    { params: { date_ref: date } },
  )
  return res.data
}
