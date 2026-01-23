import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useUserRole();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Suggest similar routes based on the attempted path
  const suggestedRoutes = useMemo(() => {
    const attemptedPath = location.pathname.toLowerCase();
    const commonRoutes = [
      { path: "/", label: "Home" },
      { path: "/trainees", label: "Trainee List" },
      { path: "/trainers", label: "Trainer Management" },
      { path: "/users", label: "User Management" },
      { path: "/classes", label: "Class Management" },
      { path: "/fees", label: "Fee Management" },
      { path: "/reports", label: "Reports" },
      { path: "/analytics", label: "Analytics" },
      { path: "/profile", label: "My Profile" },
      { path: "/messages", label: "Messages" },
      { path: "/timetable", label: "Timetable" },
      { path: "/stock", label: "Stock Management" },
      { path: "/assets", label: "Asset Management" },
      { path: "/hostel", label: "Hostel Management" },
      { path: "/applications", label: "Applications" },
    ];

    // Find routes that partially match the attempted path
    const matches = commonRoutes.filter(route => 
      attemptedPath.includes(route.path.slice(1)) || 
      route.path.includes(attemptedPath.slice(1))
    );

    return matches.slice(0, 3);
  }, [location.pathname]);

  const getDashboardRoute = () => {
    switch (role) {
      case "super_admin": return "/super-admin";
      case "admin": return "/admin-dashboard";
      case "organization_admin": return "/organization-admin-dashboard";
      case "head_of_training": return "/head-of-training-dashboard";
      case "trainer": return "/trainer-dashboard";
      case "trainee": return "/trainee-dashboard";
      case "hod": return "/hod-dashboard";
      case "debtor_officer": return "/debtor-officer-dashboard";
      case "registration_officer": return "/registration-officer-dashboard";
      case "assessment_coordinator": return "/assessment-coordinator-dashboard";
      case "stock_control_officer": return "/stock-control-officer-dashboard";
      case "asset_maintenance_coordinator": return "/asset-maintenance-coordinator-dashboard";
      case "procurement_officer": return "/procurement-officer-dashboard";
      case "placement_officer": return "/placement-officer-dashboard";
      case "hostel_coordinator": return "/hostel-coordinator-dashboard";
      case "head_of_trainee_support": return "/trainee-support-dashboard";
      default: return "/";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            Page Not Found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            The page <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code> could not be found.
          </p>
          
          {suggestedRoutes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Did you mean?
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedRoutes.map((route) => (
                  <Button
                    key={route.path}
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(route.path)}
                  >
                    {route.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => navigate(-1)} 
              variant="outline" 
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button 
              onClick={() => navigate(getDashboardRoute())} 
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;