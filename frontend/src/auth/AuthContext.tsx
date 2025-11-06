import React, { useEffect, useRef, useState } from "react";
import { login as doLogin, refresh as doRefresh } from "../api/auth";
import { setTokens } from "../api/http";
import { Ctx, type Session } from "./context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const idleTimer = useRef<number | null>(null);
  const lastActivity = useRef<number>(Date.now());
  const idleMinutes = Number(import.meta.env.VITE_IDLE_TIMEOUT_MIN ?? 15);

  function decodeJwtPayload<T = any>(jwt: string): T {
    const parts = jwt.split(".");
    if (parts.length < 2) throw new Error("Invalid JWT");
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as T;
  }

  async function signin(username: string, password: string) {
    const pair = await doLogin(username, password);
    setTokens(pair.access_token, pair.refresh_token);

    // Opcional: decodificar o access JWT para pegar sub/role
    const payload = decodeJwtPayload<{ sub: string; role: any }>(pair.access_token);
    const next = { userId: String(payload.sub), role: payload.role };
    setSession(next);
    return next;
  }

  function signout() {
    setSession(null);
    setTokens("", "");
    localStorage.removeItem("refresh_token");
  }

  // Bootstrap: if there is a refresh token, silently restore session on load
  useEffect(() => {
    const rt = localStorage.getItem("refresh_token");
    if (!session && rt) {
      doRefresh(rt)
        .then((pair) => {
          setTokens(pair.access_token, pair.refresh_token);
          const payload = decodeJwtPayload<{ sub: string; role: any }>(pair.access_token);
          setSession({ userId: String(payload.sub), role: payload.role });
        })
        .catch(() => void 0);
    }
  }, [session]);

  // Auto-logout por inatividade
  useEffect(() => {
    function resetTimer() {
      // Exceção: rota de kiosk não faz auto-logout
      const path = window.location?.pathname || "";
      const isKiosk = path.startsWith("/kiosk");
      if (isKiosk) {
        if (idleTimer.current) window.clearTimeout(idleTimer.current);
        return;
      }
      lastActivity.current = Date.now();
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (!session) return;
      const ms = Math.max(1, idleMinutes) * 60_000;
      idleTimer.current = window.setTimeout(() => {
        // Só desloga se não houver interação dentro do período
        const inactiveFor = Date.now() - lastActivity.current;
        if (inactiveFor >= ms) {
          signout();
        }
      }, ms) as unknown as number;
    }

    // Eventos de atividade
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "visibilitychange"] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true } as any));
    resetTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [session, idleMinutes]);

  return <Ctx.Provider value={{ session, signin, signout }}>{children}</Ctx.Provider>;
}

// Note: useAuth moved to ./useAuth to satisfy react-refresh rule
