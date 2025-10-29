import axios from "axios";

const envBase = import.meta.env.VITE_API_BASE_URL ?? "";
const isLocalDevHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1");
export const AUTH_API_BASE = import.meta.env.DEV && isLocalDevHost ? "" : envBase;
export const authApi = axios.create({ baseURL: AUTH_API_BASE, timeout: 10000 });

if (import.meta.env.DEV) {
  authApi.interceptors.request.use((config) => {
    // Log leve para depurar login no dev
    console.debug("[authApi]", config.method?.toUpperCase(), config.baseURL + (config.url || ""));
    return config;
  });
  authApi.interceptors.response.use(
    (r) => r,
    (err) => {
      console.debug("[authApi][error]", err?.response?.status, err?.response?.data || err?.message);
      return Promise.reject(err);
    },
  );
}

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
  const { data } = await authApi.post<TokenPair>("/auth/refresh", null, {
    params: { refresh_token: refreshToken },
  });
  return data;
}

export async function forgotPassword(email: string): Promise<{ ok: boolean }> {
  const { data } = await authApi.post<{ ok: boolean }>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  const { data } = await authApi.post<{ ok: boolean }>("/auth/reset-password", { token, new_password: newPassword });
  return data;
}
