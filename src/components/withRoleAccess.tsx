import { ComponentType, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole, UserRole } from "@/hooks/useUserRole";

interface WithRoleAccessOptions {
  requiredRoles: UserRole[];
  redirectTo?: string;
}

export function withRoleAccess<P extends object>(
  Component: ComponentType<P>,
  options: WithRoleAccessOptions
) {
  return function ProtectedComponent(props: P) {
    const { role, loading } = useUserRole();
    const navigate = useNavigate();
    const { requiredRoles, redirectTo = "/dashboard" } = options;

    useEffect(() => {
      // Super admins have access to everything
      if (!loading && role && role !== "super_admin" && !requiredRoles.includes(role)) {
        navigate(redirectTo, { replace: true });
      }
    }, [role, loading, navigate]);

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      );
    }

    // Super admins bypass all role restrictions
    if (!role || (role !== "super_admin" && !requiredRoles.includes(role))) {
      return null;
    }

    return <Component {...props} />;
  };
}
