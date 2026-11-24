import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { selectIsAdmin, useAppSelector } from "@/app/store";
import { Spinner } from "@/components/ui/primitives";

/**
 * Route guards improve UX only — every protected API call is authorized by the server.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const location = useLocation();
  if (status === "unknown") return <Spinner label="Checking your session" />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const isAdmin = useAppSelector(selectIsAdmin);
  const location = useLocation();
  if (status === "unknown") return <Spinner label="Checking your session" />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Login/register: signed-in users go to where they came from (or their home). */
export function PublicOnly({ children }: { children: ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const isAdmin = useAppSelector(selectIsAdmin);
  const location = useLocation();
  if (status === "unknown") return <Spinner label="Checking your session" />;
  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith("/") ? from : isAdmin ? "/admin" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
