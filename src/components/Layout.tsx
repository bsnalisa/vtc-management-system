import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { MODULE_CODES } from "@/lib/packageUtils";
import { DashboardLayout } from "./DashboardLayout";
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

  const navItems = [
    ...(!isTrainee ? [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }] : []),
    ...(canAccessUserManagement ? [{ title: "Users", url: "/users", icon: Shield }] : []),
    ...(canAccessTrainees && hasModuleAccess(MODULE_CODES.TRAINEE_MANAGEMENT) ? [{ title: "Trainees", url: "/trainees", icon: Users }, { title: "Register", url: "/trainees/register", icon: UserPlus }] : []),
    ...(canAccessTrainers && hasModuleAccess(MODULE_CODES.TRAINER_MANAGEMENT) ? [{ title: "Trainers", url: "/trainers", icon: GraduationCap }] : []),
    ...(canAccessAttendance && hasModuleAccess(MODULE_CODES.ATTENDANCE_TRACKING) ? [{ title: "Attendance", url: "/attendance", icon: ClipboardList }] : []),
    ...(canAccessFees && hasModuleAccess(MODULE_CODES.FEE_MANAGEMENT) ? [{ title: "Fees", url: "/fees", icon: DollarSign }] : []),
    ...(canAccessReports ? [{ title: "Reports", url: "/reports", icon: FileText }] : []),
    ...(canAccessClasses && hasModuleAccess(MODULE_CODES.CLASS_MANAGEMENT) ? [{ title: "Classes", url: "/classes", icon: BookOpen }] : []),
    ...(canAccessTimetable && hasModuleAccess(MODULE_CODES.TIMETABLE_MANAGEMENT) ? [{ title: "Timetable", url: "/timetable", icon: Calendar }] : []),
    ...(canAccessPackages ? [{ title: "Packages", url: "/packages", icon: Package }] : []),
    ...(!isTrainee ? [{ title: "Announcements", url: "/announcements", icon: Megaphone }] : []),
  ];
  return (
    <DashboardLayout title="" subtitle="" navItems={navItems} groupLabel="Navigation">
      <div className="mb-5 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" />Search</Button>
        <NotificationBell />
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {children}
    </DashboardLayout>
  );
};

export default Layout;
