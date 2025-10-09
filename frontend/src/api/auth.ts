import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";
export const authApi = axios.create({ baseURL });

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await authApi.post<TokenPair>("/auth/login", { email, password });
  return data;
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const { data } = await authApi.post<TokenPair>("/auth/refresh", { refresh_token: refreshToken });
  return data;
}
