import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useUserRole } from "@/hooks/useUserRole";
import { getRoleDisplayName, getRoleDashboardPath } from "@/lib/roleUtils";

interface BreadcrumbRoute {
  path: string;
  label: string;
}

const routeLabels: Record<string, string> = {
  "": "Home",
  "admin-dashboard": "Admin Dashboard",
  "trainer-dashboard": "Trainer Dashboard",
  "trainee-dashboard": "Trainee Dashboard",
  "hod-dashboard": "HOD Dashboard",
  "assessment-coordinator-dashboard": "Assessment Coordinator",
  "debtor-officer-dashboard": "Debtor Officer",
  "registration-officer-dashboard": "Registration Officer",
  "stock-control-officer-dashboard": "Stock Control",
  "asset-maintenance-coordinator-dashboard": "Asset Maintenance",
  "procurement-officer-dashboard": "Procurement",
  "placement-officer-dashboard": "Placement Officer",
  "hostel-coordinator-dashboard": "Hostel Coordinator",
  "super-admin": "Super Admin",
  "users": "User Management",
  "trainees": "Trainees",
  "trainers": "Trainers",
  "classes": "Classes",
  "fees": "Fee Management",
  "attendance": "Attendance",
  "enrollments": "Enrollments",
  "assessment-results": "Assessment Results",
  "timetable": "Timetable",
  "reports": "Reports",
  "analytics": "Analytics",
  "messages": "Messages",
  "announcements": "Announcements",
  "profile": "Profile",
  "assets": "Assets",
  "stock": "Stock",
  "suppliers": "Suppliers",
  "purchase-requisitions": "Purchase Requisitions",
  "purchase-orders": "Purchase Orders",
  "receiving-reports": "Receiving Reports",
  "roles": "Role Management",
  "permissions": "Permissions",
  "alumni": "Alumni",
  "hostel": "Hostel Management",
  "organizations": "Organizations",
  "packages": "Packages",
  "config": "System Config",
  "logs": "System Logs",
  "register": "Register",
  "documents": "Documents",
  "applications": "Applications",
  "training-modules": "Training Modules",
};

export const Breadcrumb = () => {
  const location = useLocation();
  const { role } = useUserRole();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const breadcrumbRoutes: BreadcrumbRoute[] = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    return { path, label };
  });

  // Include role context as home if user has a role
  const roleDisplayName = getRoleDisplayName(role);
  const roleDashboardPath = getRoleDashboardPath(role);
  
  const routes: BreadcrumbRoute[] = role && roleDisplayName
    ? [
        { path: roleDashboardPath, label: roleDisplayName },
        ...breadcrumbRoutes.filter(route => !route.path.includes("dashboard")),
      ]
    : [
        { path: "/", label: "Home" },
        ...breadcrumbRoutes,
      ];

  // Don't show breadcrumb on auth or index page
  if (location.pathname === "/" || location.pathname === "/auth") {
    return null;
  }

  return (
    <ShadcnBreadcrumb>
      <BreadcrumbList>
        {routes.map((route, index) => {
          const isLast = index === routes.length - 1;
          
          return (
            <div key={route.path} className="flex items-center">
              {index > 0 && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-1">
                    {index === 0 && <Home className="h-3.5 w-3.5" />}
                    {route.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={route.path} className="flex items-center gap-1">
                      {index === 0 && <Home className="h-3.5 w-3.5" />}
                      {route.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </ShadcnBreadcrumb>
  );
};
