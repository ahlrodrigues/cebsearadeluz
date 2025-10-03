import axios from "axios";
import { refresh } from "./auth";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
export const http = axios.create({ baseURL });

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem("refresh_token");

export function setTokens(at: string, rt: string) {
  accessToken = at;
  refreshToken = rt;
  localStorage.setItem("refresh_token", rt);
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let isRefreshing = false;
let pending: Array<(t: string | null) => void> = [];

function onRefreshed(newAccess: string | null) {
  pending.forEach((cb) => cb(newAccess));
  pending = [];
}

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          if (!refreshToken) throw new Error("No refresh token");
          const pair = await refresh(refreshToken);
          accessToken = pair.access_token;
          refreshToken = pair.refresh_token;
          localStorage.setItem("refresh_token", refreshToken);
          onRefreshed(accessToken);
        } catch {
          onRefreshed(null);
        } finally {
          isRefreshing = false;
        }
      }

      return new Promise((resolve, reject) => {
        pending.push((newAccess) => {
          if (!newAccess) return reject(error);
          original.headers.Authorization = `Bearer ${newAccess}`;
          resolve(http(original));
        });
      });
    }
    return Promise.reject(error);
  }
);
