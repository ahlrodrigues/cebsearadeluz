import { createContext } from "react";

export type Role = "user" | "entrevista" | "recepcao" | "exame" | "admin";

export type Session = { userId: string; role: Role } | null;

export type AuthCtx = {
  session: Session;
  signin: (username: string, password: string) => Promise<{ userId: string; role: Role }>;
  signout: () => void;
};

export const Ctx = createContext<AuthCtx>(null!);
