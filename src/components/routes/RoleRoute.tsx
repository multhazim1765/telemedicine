import { ReactNode } from "react";
import { UserRole } from "../../types/models";
import { ProtectedRoute } from "../ProtectedRoute";

interface RoleRouteProps {
  roles: UserRole[];
  children: ReactNode;
}

export const RoleRoute = ({ roles, children }: RoleRouteProps) => (
  <ProtectedRoute allowedRoles={roles} requireJwt>
    {children}
  </ProtectedRoute>
);
