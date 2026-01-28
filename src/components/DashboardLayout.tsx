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
import { LogOut, UserCircle, LucideIcon, Shield, PanelLeftOpen, PanelLeftClose } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast as showToast } from "sonner";
import { signOutAndClearCaches } from "@/lib/authUtils";

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
  const { state, toggleSidebar } = useSidebar();
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
        {/* Sidebar Header with Toggle */}
        <div className={`flex items-center border-b h-14 px-2 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={`gap-1.5 text-white border-transparent ${roleColorClass}`}
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
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={toggleSidebar}
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle Sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? "right" : "bottom"}>
                <p>{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Collapsed Role Icon */}
        {isCollapsed && (
          <div className="flex justify-center py-2 border-b">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${roleColorClass}`}>
                    <Shield className="h-4 w-4 text-white" />
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
                              className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 ${!hasAccess ? 'opacity-60' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
                              style={({ isActive }) => 
                                isActive ? {
                                  backgroundColor: 'hsl(var(--sidebar-primary))',
                                  color: 'white',
                                  fontWeight: '500',
                                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                                } : {
                                  color: 'hsl(var(--sidebar-foreground))'
                                }
                              }
                              onMouseEnter={(e) => {
                                if (!isActive(item.url)) {
                                  e.currentTarget.style.backgroundColor = 'hsl(var(--sidebar-accent))';
                                  e.currentTarget.style.color = 'hsl(var(--sidebar-accent-foreground))';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive(item.url)) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = 'hsl(var(--sidebar-foreground))';
                                }
                              }}
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
                                  className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" 
                                  style={{ backgroundColor: 'white' }}
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 fixed top-0 left-0 right-0 z-50">
      {/* Organization Branding */}
      {organizationName && (
        <div className="flex items-center gap-2 min-w-0">
          {settings?.logo_url && (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={settings.logo_url} alt={organizationName} />
              <AvatarFallback className="text-xs">
                {organizationName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="font-semibold text-foreground text-sm truncate hidden sm:block">
            {organizationName}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* User Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        <RoleSwitcher />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 h-8 px-2 sm:px-3"
        >
          <UserCircle className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Profile</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onSignOut}
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
  navItems,
  groupLabel,
  statsContent
}: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const { role } = useUserRole();
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
      <div className="min-h-screen flex flex-col w-full bg-background">
        {/* Top Navigation Bar */}
        <TopHeader 
          organizationName={organizationName} 
          settings={settings}
          onSignOut={handleSignOut}
        />

        {/* Spacer for fixed header */}
        <div className="h-14 shrink-0" />

        {/* Sidebar and content container */}
        <div className="flex flex-1 w-full">
          <DashboardSidebar 
            navItems={navItems} 
            groupLabel={groupLabel}
            statsContent={statsContent}
          />
          
          <main className="flex-1 flex flex-col min-w-0 overflow-auto">
            {/* Page Header */}
            <div className="border-b bg-card shrink-0">
              <div className="px-4 sm:px-6 py-2 sm:py-3 space-y-1">
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-foreground">{title}</h1>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <Breadcrumb />
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 sm:p-6 bg-muted/20">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
