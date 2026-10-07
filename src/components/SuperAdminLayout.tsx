import { ReactNode } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Shield,
  LayoutDashboard,
  Building2,
  Package,
  Users,
  Settings,
  Activity,
  LogOut,
  UserCircle,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { signOutAndClearCaches } from "@/lib/authUtils";
import { AppLogo } from "@/components/AppLogo";

interface SuperAdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: "Overview", url: "/super-admin", icon: LayoutDashboard },
  { title: "Organizations", url: "/super-admin/organizations", icon: Building2 },
  { title: "Packages", url: "/super-admin/packages", icon: Package },
  { title: "Package Assignments", url: "/super-admin/package-assignments", icon: TrendingUp },
  { title: "Modules", url: "/super-admin/modules", icon: Package },
  { title: "Users", url: "/super-admin/users", icon: Users },
  { title: "Analytics", url: "/super-admin/analytics", icon: BarChart3 },
  { title: "Roles", url: "/super-admin/roles", icon: Shield },
  { title: "Security Audit", url: "/super-admin/audit-logs", icon: Shield },
  { title: "System Config", url: "/super-admin/config", icon: Settings },
  { title: "Activity Logs", url: "/super-admin/logs", icon: Activity },
];

function SuperAdminSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const roleThemeClass = 'role-super-admin'; // Super admin role

  const isActive = (path: string) => {
    if (path === "/super-admin") {
      return location.pathname === "/super-admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {open && <div className="px-4 py-5 font-semibold text-sidebar-foreground">VTC System</div>}
        {/* Role Badge + Toggle in Sidebar Header */}
        <div className={`flex items-center border-b h-14 px-2 ${open ? "justify-between" : "justify-center"}`}>
          {open && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent text-sidebar-foreground text-xs font-medium">
              <Shield className="h-3 w-3" />
              <span>Super Admin</span>
            </div>
          )}
          <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Platform Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/super-admin"}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${active ? "bg-sidebar-primary/20 text-sidebar-primary-foreground font-semibold" : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {active && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Stats Section */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel>Platform Stats</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-3 px-2 py-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sidebar-foreground/65">Active VTCs</span>
                <span className="font-medium text-green-600 dark:text-green-500">24</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-sidebar-foreground/65">Total Users</span>
                <span className="font-medium text-blue-600 dark:text-blue-500">1,234</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-sidebar-foreground/65">System Health</span>
                <span className="font-medium text-green-600 dark:text-green-500">99.8%</span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export const SuperAdminLayout = ({ children }: SuperAdminLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOutAndClearCaches(queryClient);
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/auth");
  };

  const getPageTitle = () => {
    const currentItem = navItems.find(item => 
      item.url === "/super-admin" 
        ? location.pathname === "/super-admin"
        : location.pathname.startsWith(item.url)
    );
    return currentItem?.title || "Super Admin Portal";
  };

  return (
    <SidebarProvider>
      <div className="dashboard-workspace h-svh flex w-full overflow-hidden bg-background">
        <SuperAdminSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 z-40">
            <div className="px-3 sm:px-6 py-3 sm:py-4 space-y-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <AppLogo className="h-8 w-8" />
                    <div className="min-w-0">
                      <h1 className="break-words text-base sm:text-lg font-bold text-foreground">{getPageTitle()}</h1>
                      <p className="text-xs text-muted-foreground">Platform Management Dashboard</p>
                    </div>
                  </div>
                </div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate("/profile")}
                  aria-label="Profile"
                  className="flex items-center gap-2"
                >
                  <UserCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="flex items-center gap-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
              </div>
              <div className="px-2">
                <Breadcrumb />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="workspace-content min-h-0 min-w-0 overflow-auto flex-1 p-3 sm:p-5 lg:p-8 bg-background">
            <div className="min-w-0 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};