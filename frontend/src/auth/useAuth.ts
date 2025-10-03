import { useContext } from "react";
import { Ctx } from "./context";

export function useAuth() {
  return useContext(Ctx);
}



