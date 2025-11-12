import { http } from "./http";

export type PassSessionStatus = "Presente" | "Ausente";
export type PassCycleStatus = "Ativo" | "Concluído" | "Interrompido";
export type PassType = "P1" | "P2" | "P3A" | "P3B" | "CH" | "P4A" | "P4B";

export interface PassSession {
  id: number;
  cycle_id: number;
  sequence_index: number;
  scheduled_for: string;
  status: PassSessionStatus;
  notes?: string | null;
  presence_recorded_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PassCycle {
  id: number;
  user_id: number;
  stage_number: number;
  pass_type: PassType;
  status: PassCycleStatus;
  sequence_length: number;
  started_at: string;
  completed_at?: string | null;
  interrupted_at?: string | null;
  requires_interview: boolean;
  interview_scheduled_for?: string | null;
  interview_completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  sessions: PassSession[];
}

export interface PassOccurrencePayload {
  date?: string;
  notes?: string;
}

export interface PassScanPayload {
  token?: string;
  user_id?: number;
  date?: string;
  notes?: string;
}

export interface ScanKioskResponse {
  ticket_number: number;
  user_id: number;
  user_name: string;
  session: PassSession;
}

export const fetchPassCycles = async (userId: number): Promise<PassCycle[]> => {
  const response = await http.get<PassCycle[]>(
    `/users/${userId}/pass-cycles`,
  );
  return response.data;
};

export const fetchActivePassCycle = async (
  userId: number,
): Promise<PassCycle> => {
  const response = await http.get<PassCycle>(
    `/users/${userId}/pass-cycles/active`,
  );
  return response.data;
};

export const registerPassPresence = async (
  userId: number,
  payload: PassOccurrencePayload,
): Promise<PassSession> => {
  const response = await http.post<PassSession>(
    `/users/${userId}/passes/presence`,
    payload,
  );
  return response.data;
};

export const registerPassAbsence = async (
  userId: number,
  payload: PassOccurrencePayload,
): Promise<PassSession> => {
  const response = await http.post<PassSession>(
    `/users/${userId}/passes/absence`,
    payload,
  );
  return response.data;
};

export const scanPassPresence = async (
  payload: PassScanPayload,
): Promise<PassSession> => {
  const response = await http.post<PassSession>(`/passes/scan`, payload);
  return response.data;
};

export const scanPassPresenceKiosk = async (
  payload: PassScanPayload,
): Promise<ScanKioskResponse> => {
  const response = await http.post<ScanKioskResponse>(
    `/passes/scan-kiosk`,
    payload,
  );
  return response.data;
};

export const deletePassSession = async (
  userId: number,
  sessionId: number,
): Promise<void> => {
  await http.delete(`/users/${userId}/passes/${sessionId}`);
};
