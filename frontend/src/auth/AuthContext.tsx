import React, { useState } from "react";
import { login as doLogin } from "../api/auth";
import { setTokens } from "../api/http";
import { Ctx, type Session } from "./context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);

  async function signin(username: string, password: string) {
    const pair = await doLogin(username, password);
    setTokens(pair.access_token, pair.refresh_token);

    // Opcional: decodificar o access JWT para pegar sub/role
    const payload = JSON.parse(atob(pair.access_token.split(".")[1]));
    setSession({ userId: payload.sub, role: payload.role });
  }

  function signout() {
    setSession(null);
    setTokens("", "");
    localStorage.removeItem("refresh_token");
  }

  return <Ctx.Provider value={{ session, signin, signout }}>{children}</Ctx.Provider>;
}

// Note: useAuth moved to ./useAuth to satisfy react-refresh rule
