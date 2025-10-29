import { http } from "./http";

export type ExamRecommendationValue =
  | "evangelho_no_lar"
  | "preces"
  | "leituras"
  | "vigilancia"
  | "eae"
  | "trabalho"
  | "otimismo"
  | "confiar_em_jesus";

export interface ExamRecordResponse {
  id: number;
  user_id: number;
  answers?: string | null;
  observations?: string | null;
  recommendations: ExamRecommendationValue[];
  next_pass_type?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ExamRecordCreatePayload {
  answers?: string | null;
  observations?: string | null;
  recommendations?: ExamRecommendationValue[];
  next_pass_type?: string | null;
}

export type ExamRecordUpdatePayload = Partial<ExamRecordCreatePayload>;

export const getExamRecord = async (
  userId: number,
): Promise<ExamRecordResponse | null> => {
  try {
    const response = await http.get<ExamRecordResponse>(
      `/users/${userId}/exam`,
    );
    return response.data;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw error;
  }
};

export const createExamRecord = async (
  userId: number,
  payload: ExamRecordCreatePayload,
): Promise<ExamRecordResponse> => {
  const response = await http.post<ExamRecordResponse>(
    `/users/${userId}/exam`,
    payload,
  );
  return response.data;
};

export const updateExamRecord = async (
  userId: number,
  payload: ExamRecordUpdatePayload,
): Promise<ExamRecordResponse> => {
  const response = await http.put<ExamRecordResponse>(
    `/users/${userId}/exam`,
    payload,
  );
  return response.data;
};
