import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function PrivateRoute({ children }: { children: JSX.Element }) {
  const { session } = useAuth();
  const hasRefresh = !!localStorage.getItem("refresh_token");
  if (!session && hasRefresh) return <div />; // aguarda bootstrap silencioso
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export function RoleRoute({ roles, children }: { roles: Array<"user"|"entrevista"|"recepcao"|"exame"|"admin">; children: JSX.Element }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.role)) return <Navigate to="/403" replace />;
  return children;
}
