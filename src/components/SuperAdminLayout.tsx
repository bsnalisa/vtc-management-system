import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { NavLink } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";

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
        {/* Role Badge in Sidebar Header */}
        <div className="px-4 py-3 border-b">
          <div 
            className="w-full flex justify-center items-center gap-2 px-3 py-2 rounded-md text-white text-xs font-medium"
            style={{
              backgroundColor: `hsl(var(--role-super-admin))`
            }}
          >
            <Shield className="h-3 w-3" />
            <span>Super Admin</span>
          </div>
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
                        className="flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200"
                        style={({ isActive }) => 
                          isActive ? {
                            backgroundColor: `hsl(var(--role-super-admin))`,
                            color: 'white',
                            fontWeight: '500',
                            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                          } : {
                            color: 'hsl(var(--muted-foreground))'
                          }
                        }
                        onMouseEnter={(e) => {
                          if (!isActive(item.url)) {
                            e.currentTarget.style.backgroundColor = `hsl(var(--role-super-admin) / 0.1)`;
                            e.currentTarget.style.color = `hsl(var(--role-super-admin))`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive(item.url)) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                          }
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {active && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'white' }} />
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
                <span className="text-muted-foreground">Active VTCs</span>
                <span className="font-medium text-green-600 dark:text-green-500">24</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Users</span>
                <span className="font-medium text-blue-600 dark:text-blue-500">1,234</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">System Health</span>
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
      <div className="min-h-screen flex w-full bg-background">
        <SuperAdminSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger />
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-foreground">{getPageTitle()}</h1>
                      <p className="text-xs text-muted-foreground">Platform Management Dashboard</p>
                    </div>
                  </div>
                </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2"
                >
                  <UserCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSignOut}
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
          <main className="flex-1 p-6 bg-muted/20">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};