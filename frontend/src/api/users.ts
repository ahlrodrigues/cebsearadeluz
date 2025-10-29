import { http } from "./http";
import type { PassType } from "./passes";

export type UserStatus = "Ativo" | "Desativado";
export type UserRole = "user" | "admin";
export type AssistanceDay =
  | "Segunda-feira"
  | "Terça-feira"
  | "Quarta-feira"
  | "Quinta-feira"
  | "Sexta-feira"
  | "Sábado"
  | "Domingo";

export interface CreateUserPayload {
  full_name: string;
  password: string;
  social_name?: string;
  birth_date?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  social_network?: string;
  status: UserStatus;
  role: UserRole;
  assistance_day?: AssistanceDay;
}

export interface UserResponse {
  id: number;
  full_name: string;
  social_name?: string | null;
  birth_date?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  social_network?: string | null;
  status: UserStatus;
  role: UserRole;
  assistance_day?: AssistanceDay | null;
  created_at: string;
  updated_at?: string | null;
  has_active_cycle: boolean;
  active_cycle_pass_type?: PassType | null;
  active_cycle_stage_number?: number | null;
  active_cycle_sequence_length?: number | null;
  active_cycle_presence_count?: number | null;
  active_cycle_absence_count?: number | null;
  active_cycle_next_session?: string | null;
  active_cycle_requires_interview?: boolean | null;
  active_cycle_interview_scheduled_for?: string | null;
  active_cycle_last_presence_recorded_at?: string | null;
}

export interface UserQrResponse {
  id: number;
  name: string;
}

export interface UserQrTokenResponse {
  token: string;
}

export interface UserFilters {
  search?: string;
  status?: UserStatus;
  role?: UserRole;
  assistance_day?: AssistanceDay;
  skip?: number;
  limit?: number;
}

// Ensure assistance_day can be explicitly cleared with null by removing it from the Partial base
export type UpdateUserPayload =
  Partial<Omit<CreateUserPayload, "password" | "assistance_day">> & {
    password?: string;
    assistance_day?: AssistanceDay | null;
  };

const cleanPayload = (payload: CreateUserPayload): CreateUserPayload => {
  const normalize = (value?: string) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const result: CreateUserPayload = {
    full_name: payload.full_name.trim(),
    password: payload.password.trim(),
    status: payload.status,
    role: payload.role,
  };

  const assign = <K extends keyof CreateUserPayload>(
    key: K,
    value?: string,
    transform?: (input: string) => string,
  ) => {
    const normalized = normalize(value);
    if (normalized !== undefined) {
      result[key] = (
        transform ? transform(normalized) : normalized
      ) as CreateUserPayload[K];
    }
  };

  assign("social_name", payload.social_name);
  assign("birth_date", payload.birth_date);
  assign("cep", payload.cep);
  assign("street", payload.street);
  assign("number", payload.number);
  assign("complement", payload.complement);
  assign("neighborhood", payload.neighborhood);
  assign("city", payload.city);
  assign("state", payload.state, (value) => value.toUpperCase());
  assign("phone", payload.phone);
  assign("email", payload.email);
  assign("social_network", payload.social_network);

  if (payload.assistance_day) {
    result.assistance_day = payload.assistance_day;
  }

  return result;
};

export const createUser = async (
  payload: CreateUserPayload,
): Promise<UserResponse> => {
  const response = await http.post<UserResponse>(
    "/users",
    cleanPayload(payload),
  );
  return response.data;
};

export const fetchUsers = async (
  filters: UserFilters = {},
): Promise<UserResponse[]> => {
  const params: Record<string, string | number> = {};

  if (filters.search) {
    params.search = filters.search;
  }
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.role) {
    params.role = filters.role;
  }
  if (filters.assistance_day) {
    params.assistance_day = filters.assistance_day;
  }
  if (typeof filters.skip === "number") {
    params.skip = filters.skip;
  }
  if (typeof filters.limit === "number") {
    params.limit = filters.limit;
  }

  const response = await http.get<UserResponse[]>("/users", { params });
  return response.data;
};

export const getUser = async (userId: number): Promise<UserResponse> => {
  const response = await http.get<UserResponse>(`/users/${userId}`);
  return response.data;
};

export const getUserQrData = async (
  userId: number,
): Promise<UserQrResponse> => {
  const response = await http.get<UserQrResponse>(`/users/${userId}/qr`);
  return response.data;
};

export const getUserQrToken = async (
  userId: number,
): Promise<UserQrTokenResponse> => {
  const response = await http.get<UserQrTokenResponse>(
    `/users/${userId}/qr-token`,
  );
  return response.data;
};

const cleanUpdatePayload = (payload: UpdateUserPayload): UpdateUserPayload => {
  const normalize = (value?: string) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const result: UpdateUserPayload = {};

  const assign = <K extends keyof UpdateUserPayload>(
    key: K,
    value: UpdateUserPayload[K],
    transform?: (input: string) => string,
  ) => {
    if (typeof value === "string") {
      const normalized = normalize(value);
      if (normalized !== undefined) {
        result[key] = transform
          ? (transform(normalized) as UpdateUserPayload[K])
          : (normalized as UpdateUserPayload[K]);
      }
      return;
    }

    if (value !== undefined) {
      result[key] = value;
    }
  };

  assign("full_name", payload.full_name);
  assign("social_name", payload.social_name);
  assign("birth_date", payload.birth_date);
  assign("cep", payload.cep);
  assign("street", payload.street);
  assign("number", payload.number);
  assign("complement", payload.complement);
  assign("neighborhood", payload.neighborhood);
  assign("city", payload.city);
  assign("state", payload.state, (value) => value.toUpperCase());
  assign("phone", payload.phone);
  assign("email", payload.email);
  assign("social_network", payload.social_network);
  assign("status", payload.status);
  assign("role", payload.role);
  assign("password", payload.password);

  if ("assistance_day" in payload) {
    // Keep explicit null to clear the value; otherwise omit
    result.assistance_day = (payload.assistance_day ?? null) as UpdateUserPayload['assistance_day'];
  }

  return result;
};

export const updateUser = async (
  userId: number,
  payload: UpdateUserPayload,
): Promise<UserResponse> => {
  const response = await http.put<UserResponse>(
    `/users/${userId}`,
    cleanUpdatePayload(payload),
  );
  return response.data;
};

export const deleteUser = async (userId: number): Promise<void> => {
  await http.delete(`/users/${userId}`);
};
