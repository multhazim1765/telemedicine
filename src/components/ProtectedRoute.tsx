import { Navigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "../types/models";
import { hasRole, isJwtSessionValid } from "../services/authService";
import { MedicalSpinner } from "./ui/Feedback";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
  requireJwt?: boolean;
}

export const ProtectedRoute = ({
  children,
  allowedRoles,
  redirectTo = "/login",
  requireJwt = false
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const [jwtOk, setJwtOk] = useState(!requireJwt);
  const [checkingJwt, setCheckingJwt] = useState(requireJwt);

  useEffect(() => {
    let cancelled = false;

    if (!requireJwt) {
      setJwtOk(true);
      setCheckingJwt(false);
      return;
    }

    setCheckingJwt(true);
    void isJwtSessionValid()
      .then((valid) => {
        if (!cancelled) {
          setJwtOk(valid);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingJwt(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requireJwt, user?.uid]);

  if (isLoading || checkingJwt) {
    return <MedicalSpinner fullScreen label="Checking access" message="Verifying your account and permissions" />;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requireJwt && !jwtOk) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!hasRole(user.role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
