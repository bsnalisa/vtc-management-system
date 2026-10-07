import { ReactNode, useEffect } from "react";
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
import { LogOut, UserCircle, LucideIcon, Shield, GraduationCap } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useUserRole } from "@/hooks/useUserRole";
import { getRoleDisplayName } from "@/lib/roleUtils";
import { getRoleColor } from "@/lib/roleTheme";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { useLogActivity } from "@/hooks/useRoleActivity";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { toast as showToast } from "sonner";
import { signOutAndClearCaches } from "@/lib/authUtils";
import { AppLogo } from "@/components/AppLogo";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  navItems: NavItem[];
  groupLabel?: string;
  statsContent?: ReactNode;
}

function DashboardSidebar({ 
  navItems, 
  groupLabel = "Navigation",
  statsContent,
}: { 
  navItems: NavItem[]; 
  groupLabel?: string;
  statsContent?: ReactNode;
}) {
  const location = useLocation();
  const { mutate: logActivity } = useLogActivity();
   const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  const { role } = useUserRole();
  const roleDisplayName = getRoleDisplayName(role);
  const roleColorClass = getRoleColor(role);
  
  // Track page views for analytics
  useEffect(() => {
    const currentItem = navItems.find(item => location.pathname === item.url);
    if (currentItem && role) {
      const moduleCode = currentItem.url.replace(/^\//, '').replace(/-/g, '_') || 'dashboard';
      logActivity({
        module_code: moduleCode,
        action: 'view',
        page_url: location.pathname,
      });
    }
  }, [location.pathname, role]);

  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar">
      <SidebarContent className="pt-0">
        {!isCollapsed && <div className="px-4 py-5 font-semibold text-sidebar-foreground">VTC System</div>}
        {/* Sidebar Header with Toggle */}
        <div className={`flex items-center border-b h-14 px-2 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="gap-1.5 text-sidebar-foreground border-sidebar-border bg-sidebar-accent"
                  >
                    <Shield className="h-3 w-3" />
                    <span className="text-xs font-medium truncate max-w-[120px]">{roleDisplayName}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Current Role: {roleDisplayName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>

        {/* Collapsed Role Icon */}
        {isCollapsed && (
          <div className="flex justify-center py-2 border-b">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                    <Shield className="h-4 w-4 text-sidebar-primary-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{roleDisplayName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);
                const hasAccess = true;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <NavLink
                              to={item.url}
                              end
                               className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${isCollapsed ? 'justify-center px-2' : ''} ${active ? 'bg-sidebar-primary/20 text-sidebar-primary-foreground font-semibold' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {!isCollapsed && (
                                <span className="flex items-center gap-2 truncate">
                                  {item.title}
                                  {!hasAccess && <Lock className="h-3 w-3" />}
                                </span>
                              )}
                              {active && hasAccess && !isCollapsed && (
                                <div 
                                  className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 bg-sidebar-primary"
                                />
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {(isCollapsed || !hasAccess) && (
                          <TooltipContent side="right">
                            <p>{!hasAccess ? "Limited access - contact admin" : item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {statsContent && !isCollapsed && (
          <SidebarGroup className="mt-8">
            {statsContent}
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

function TopHeader({ 
  organizationName, 
  settings, 
  onSignOut 
}: { 
  organizationName: string | null;
  settings: any;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:gap-3 sm:px-4 fixed top-0 left-0 right-0 z-50">
      <SidebarTrigger className="md:hidden text-muted-foreground hover:bg-accent hover:text-foreground" />
      <AppLogo className="h-8 w-8" />
      {/* Organization Branding */}
      {organizationName && (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground text-sm truncate">
            {organizationName}
          </span>
        </div>
      )}

      {!organizationName && <div className="flex-1" />}

      {/* User Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <RoleSwitcher />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/profile")}
          aria-label="Profile"
          className="flex items-center gap-2 h-8 px-2 sm:px-3"
        >
          <UserCircle className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Profile</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 sm:px-3"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}

export const DashboardLayout = ({ 
  children, 
  title, 
  subtitle,
  navItems: pageNavItems,
  groupLabel: pageGroupLabel,
  statsContent
}: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const { role } = useUserRole();
  const roleNav = useRoleNavigation();
  // Navigation is always derived from the signed-in role so labels stay consistent across pages.
  const useRoleNav = !!role && pageNavItems.length > 0;
  const navItems = useRoleNav ? roleNav.navItems : pageNavItems;
  const groupLabel = useRoleNav ? roleNav.groupLabel : pageGroupLabel;
  const { organizationName, settings } = useOrganizationContext();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOutAndClearCaches(queryClient);
    showToast.success("You have been signed out successfully.");
    navigate("/auth");
  };

  const getPageTitle = () => {
    const currentItem = navItems.find(item => location.pathname === item.url);
    const pageTitle = currentItem?.title || title;
    const roleDisplayName = getRoleDisplayName(role);
    return roleDisplayName ? `${roleDisplayName} - ${pageTitle}` : pageTitle;
  };

  // Update browser document title
  useEffect(() => {
    const fullTitle = getPageTitle();
    document.title = fullTitle ? `${fullTitle} | TVET MIS` : "TVET MIS";
  }, [location.pathname, role, title]);
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dashboard-workspace h-svh flex flex-col w-full bg-background overflow-hidden">
        {/* Top Navigation Bar */}
        <TopHeader 
          organizationName={organizationName} 
          settings={settings}
          onSignOut={handleSignOut}
        />

        {/* Spacer for fixed header */}
        <div className="h-14 shrink-0" />

        {/* Sidebar and content container */}
        <div className="flex flex-1 min-h-0 w-full">
          <DashboardSidebar 
            navItems={navItems} 
            groupLabel={groupLabel}
            statsContent={statsContent}
          />
          
          <main className="flex-1 flex flex-col min-w-0 overflow-auto">
            {/* Page Header */}
            {(title || subtitle) && <div className="shrink-0">
              <div className="px-4 sm:px-6 py-2 sm:py-3 space-y-1">
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-foreground">{title}</h1>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <Breadcrumb />
              </div>
            </div>}

            {/* Main Content */}
            <div className="workspace-content min-w-0 flex-1 p-3 sm:p-5 lg:p-8 bg-background">
              <div className="min-w-0 max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
