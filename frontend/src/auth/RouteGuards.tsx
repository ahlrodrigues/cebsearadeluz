import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function PrivateRoute({ children }: { children: JSX.Element }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export function RoleRoute({ roles, children }: { roles: Array<"user"|"admin">; children: JSX.Element }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.role)) return <Navigate to="/403" replace />;
  return children;
}
