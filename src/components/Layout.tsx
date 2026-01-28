import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { MODULE_CODES } from "@/lib/packageUtils";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { signOutAndClearCaches } from "@/lib/authUtils";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  DollarSign,
  FileText,
  LogOut,
  Shield,
  BookOpen,
  Calendar,
  Megaphone,
  UserCircle,
  Package,
  Search,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { hasModuleAccess } = useOrganizationContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOutAndClearCaches(queryClient);
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/auth");
  };

  // Role-based access (existing)
  const canAccessTrainees = role === "admin" || role === "registration_officer" || role === "hod";
  const canAccessTrainers = role === "admin" || role === "registration_officer" || role === "hod";
  const canAccessAttendance = role === "admin" || role === "trainer" || role === "hod" || role === "assessment_coordinator";
  const canAccessFees = role === "admin" || role === "debtor_officer" || role === "hod";
  const canAccessReports = role === "admin" || role === "hod" || role === "assessment_coordinator";
  const canAccessUserManagement = role === "admin" || role === "organization_admin";
  const canAccessClasses = role === "admin" || role === "registration_officer" || role === "hod";
  const canAccessTimetable = role === "admin" || role === "trainer" || role === "hod";
  const canAccessPackages = role === "admin" || role === "organization_admin";
  const isTrainee = role === "trainee";

  const isActiveRoute = (path: string) => location.pathname === path;

  const getNavButtonStyle = (path: string) => {
    const isActive = isActiveRoute(path);
    return {
      color: isActive ? 'white' : 'hsl(var(--muted-foreground))',
      backgroundColor: isActive ? 'hsl(var(--primary))' : 'transparent',
      borderBottomColor: isActive ? 'hsl(var(--primary))' : 'transparent',
      fontWeight: isActive ? '500' : '400'
    };
  };

  const handleNavButtonHover = (e: React.MouseEvent<HTMLButtonElement>, isEntering: boolean, path: string) => {
    if (!isActiveRoute(path)) {
      if (isEntering) {
        e.currentTarget.style.color = 'hsl(var(--primary))';
        e.currentTarget.style.borderBottomColor = 'hsl(var(--primary))';
      } else {
        e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
        e.currentTarget.style.borderBottomColor = 'transparent';
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">VTC Management System</h1>
                <p className="text-xs text-muted-foreground">Complete training centre management solution</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <NotificationBell />
              <Button variant="ghost" onClick={() => navigate("/profile")}>
                <UserCircle className="mr-2 h-4 w-4" />
                Profile
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            {!isTrainee && (
              <button
                onClick={() => navigate("/dashboard")}
                style={getNavButtonStyle("/dashboard")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/dashboard")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/dashboard")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>
            )}
            
            {canAccessUserManagement && (
              <button
                onClick={() => navigate("/users")}
                style={getNavButtonStyle("/users")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/users")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/users")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <Shield className="h-4 w-4" />
                Users
              </button>
            )}
            
            {canAccessTrainees && hasModuleAccess(MODULE_CODES.TRAINEE_MANAGEMENT) && (
              <>
                <button
                  onClick={() => navigate("/trainees")}
                  style={getNavButtonStyle("/trainees")}
                  onMouseEnter={(e) => handleNavButtonHover(e, true, "/trainees")}
                  onMouseLeave={(e) => handleNavButtonHover(e, false, "/trainees")}
                  className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
                >
                  <Users className="h-4 w-4" />
                  Trainees
                </button>
                <button
                  onClick={() => navigate("/trainees/register")}
                  style={getNavButtonStyle("/trainees/register")}
                  onMouseEnter={(e) => handleNavButtonHover(e, true, "/trainees/register")}
                  onMouseLeave={(e) => handleNavButtonHover(e, false, "/trainees/register")}
                  className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
                >
                  <UserPlus className="h-4 w-4" />
                  Register
                </button>
              </>
            )}
            
            {canAccessTrainers && hasModuleAccess(MODULE_CODES.TRAINER_MANAGEMENT) && (
              <button
                onClick={() => navigate("/trainers")}
                style={getNavButtonStyle("/trainers")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/trainers")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/trainers")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <GraduationCap className="h-4 w-4" />
                Trainers
              </button>
            )}
            
            {canAccessAttendance && hasModuleAccess(MODULE_CODES.ATTENDANCE_TRACKING) && (
              <button
                onClick={() => navigate("/attendance")}
                style={getNavButtonStyle("/attendance")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/attendance")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/attendance")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <ClipboardList className="h-4 w-4" />
                Attendance
              </button>
            )}
            
            {canAccessFees && hasModuleAccess(MODULE_CODES.FEE_MANAGEMENT) && (
              <button
                onClick={() => navigate("/fees")}
                style={getNavButtonStyle("/fees")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/fees")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/fees")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <DollarSign className="h-4 w-4" />
                Fees
              </button>
            )}
            
            {canAccessReports && (
              <button
                onClick={() => navigate("/reports")}
                style={getNavButtonStyle("/reports")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/reports")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/reports")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <FileText className="h-4 w-4" />
                Reports
              </button>
            )}
            
            {canAccessClasses && hasModuleAccess(MODULE_CODES.CLASS_MANAGEMENT) && (
              <button
                onClick={() => navigate("/classes")}
                style={getNavButtonStyle("/classes")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/classes")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/classes")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <BookOpen className="h-4 w-4" />
                Classes
              </button>
            )}
            
            {canAccessTimetable && hasModuleAccess(MODULE_CODES.TIMETABLE_MANAGEMENT) && (
              <button
                onClick={() => navigate("/timetable")}
                style={getNavButtonStyle("/timetable")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/timetable")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/timetable")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <Calendar className="h-4 w-4" />
                Timetable
              </button>
            )}
            
            {canAccessPackages && (
              <button
                onClick={() => navigate("/packages")}
                style={getNavButtonStyle("/packages")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/packages")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/packages")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <Package className="h-4 w-4" />
                Packages
              </button>
            )}
            
            {!isTrainee && (
              <button
                onClick={() => navigate("/announcements")}
                style={getNavButtonStyle("/announcements")}
                onMouseEnter={(e) => handleNavButtonHover(e, true, "/announcements")}
                onMouseLeave={(e) => handleNavButtonHover(e, false, "/announcements")}
                className="flex items-center gap-2 px-3 py-3 text-sm transition-colors border-b-2 rounded-t-md"
              >
                <Megaphone className="h-4 w-4" />
                Announcements
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
};

export default Layout;
