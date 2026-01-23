import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { getRoleDashboardPath } from "@/lib/roleUtils";
import { UserRole } from "@/hooks/useUserRole";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Fetch user role directly
const fetchUserRole = async (userId: string): Promise<UserRole> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
  
  return (data?.role as UserRole) || null;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const initialCheckDone = useRef(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession?.user) {
        setSession(currentSession);
        
        // If on /dashboard, redirect to role-specific dashboard
        if (location.pathname === "/dashboard") {
          const role = await fetchUserRole(currentSession.user.id);
          const dashboardPath = getRoleDashboardPath(role);
          if (dashboardPath && dashboardPath !== "/" && dashboardPath !== "/dashboard") {
            navigate(dashboardPath, { replace: true });
            return;
          }
        }
      }
      
      setLoading(false);
      initialCheckDone.current = true;
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (initialCheckDone.current) {
        if (event === 'SIGNED_OUT') {
          setSession(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
