import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export function BranchAuthGuard({ children }: { children: ReactNode }) {
  const { staff } = useAuth();
  if (!staff) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
