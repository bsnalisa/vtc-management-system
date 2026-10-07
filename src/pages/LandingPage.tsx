import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";


const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // User is logged in, redirect to dashboard
        navigate("/dashboard");
      } else {
        // User is not logged in, redirect to auth
        navigate("/auth");
      }
    });
  }, [navigate]);

  // Show loading spinner while checking auth status
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <LoadingIndicator className="h-12 w-12 text-primary mx-auto" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

export default LandingPage;
