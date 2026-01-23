import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { getRoleDashboardPath } from "@/lib/roleUtils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const Dashboard = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();

  useEffect(() => {
    if (!loading && role) {
      const dashboardPath = getRoleDashboardPath(role);
      if (dashboardPath && dashboardPath !== "/" && dashboardPath !== "/dashboard") {
        navigate(dashboardPath, { replace: true });
      }
    } else if (!loading && !role) {
      // No role assigned, redirect to auth
      navigate("/auth", { replace: true });
    }
  }, [role, loading, navigate]);

  // Only show minimal loading - redirect happens immediately
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingSpinner size="lg" text="Loading your dashboard..." />
    </div>
  );
};

export default Dashboard;
