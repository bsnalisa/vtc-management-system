import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { ComponentType, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole, UserRole } from "@/hooks/useUserRole";

interface WithRoleAccessOptions {
  /** Roles that may open the page. Omit to allow every signed-in role except the blocked ones. */
  requiredRoles?: UserRole[];
  /** Roles that must not open the page even though others may (the Super Admin is never blocked). */
  blockedRoles?: UserRole[];
  redirectTo?: string;
}

export function withRoleAccess<P extends object>(
  Component: ComponentType<P>,
  options: WithRoleAccessOptions
) {
  return function ProtectedComponent(props: P) {
    const { role, loading } = useUserRole();
    const navigate = useNavigate();
    const { requiredRoles, blockedRoles = [], redirectTo = "/dashboard" } = options;
    const allowed = (r: UserRole) => r === "super_admin" || (!blockedRoles.includes(r) && (!requiredRoles || requiredRoles.includes(r)));
    const permitted = !!role && allowed(role);

    useEffect(() => {
      // Super admins have access to everything
      if (!loading && role && !permitted) {
        navigate(redirectTo, { replace: true });
      }
    }, [role, loading, permitted, navigate, redirectTo]);

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <LoadingIndicator className="h-8 w-8 mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      );
    }

    // Super admins bypass all role restrictions
    if (!role || !permitted) {
      return null;
    }

    return <Component {...props} />;
  };
}
