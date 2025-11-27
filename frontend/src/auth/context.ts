import { createContext } from "react";

export type Role = "user" | "entrevista" | "recepcao" | "exame" | "admin";

export type Session = { userId: string; roles: Role[] } | null;

export type AuthCtx = {
  session: Session;
  booting: boolean;
  signin: (username: string, password: string) => Promise<{ userId: string; roles: Role[] }>;
  signout: () => void;
};

export const Ctx = createContext<AuthCtx>(null!);
