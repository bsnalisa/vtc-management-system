import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { hasModuleAccess as checkModuleAccess } from "@/lib/packageUtils";

interface OrganizationSettings {
  logo_url: string | null;
  color_theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  favicon: string | null;
}

interface PackageInfo {
  package_id: string;
  package_name: string;
  module_access: string[];
  limits: {
    max_trainees: number | null;
    max_trainers: number | null;
    max_classes: number | null;
    max_storage_mb: number | null;
  };
  is_trial: boolean;
  end_date: string | null;
  status: string;
}

interface OrganizationContextType {
  organizationId: string | null;
  organizationName: string | null;
  package: "basic" | "extended" | "professional" | null;
  packageInfo: PackageInfo | null;
  settings: OrganizationSettings | null;
  hasModuleAccess: (moduleCode: string) => boolean;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizationId: null,
  organizationName: null,
  package: null,
  packageInfo: null,
  settings: null,
  hasModuleAccess: () => false,
  loading: true,
});

export const useOrganizationContext = () => useContext(OrganizationContext);

// Cache for organization data
let cachedOrgData: {
  organizationId: string | null;
  organizationName: string | null;
  packageType: "basic" | "extended" | "professional" | null;
  settings: OrganizationSettings | null;
  userId: string | null;
} | null = null;

export const clearOrganizationCache = () => {
  cachedOrgData = null;
};

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { role, loading: roleLoading } = useUserRole();
  const [organizationId, setOrganizationId] = useState<string | null>(cachedOrgData?.organizationId || null);
  const [organizationName, setOrganizationName] = useState<string | null>(cachedOrgData?.organizationName || null);
  const [packageType, setPackageType] = useState<"basic" | "extended" | "professional" | null>(cachedOrgData?.packageType || null);
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(cachedOrgData?.settings || null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(!cachedOrgData);
  const hasFetched = useRef(false);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (roleLoading) return;
      if (role === "super_admin") {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Use cached data if same user
        if (cachedOrgData && cachedOrgData.userId === user.id && hasFetched.current) {
          setOrganizationId(cachedOrgData.organizationId);
          setOrganizationName(cachedOrgData.organizationName);
          setPackageType(cachedOrgData.packageType);
          setSettings(cachedOrgData.settings);
          setLoading(false);
          return;
        }

        // Get user's organization ID first (required for other queries)
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!userRole?.organization_id) {
          setLoading(false);
          return;
        }

        const orgId = userRole.organization_id;
        setOrganizationId(orgId);

        // Fetch all organization data in parallel for speed
        const [orgResult, settingsResult, packageResult, modulesResult] = await Promise.all([
          supabase
            .from("organizations")
            .select("name, package")
            .eq("id", orgId)
            .single(),
          supabase
            .from("organization_settings")
            .select("logo_url, color_theme, favicon")
            .eq("organization_id", orgId)
            .maybeSingle(),
          supabase
            .rpc('get_organization_active_package', { _org_id: orgId })
            .maybeSingle(),
          supabase
            .from("organization_modules")
            .select(`modules (code)`)
            .eq("organization_id", orgId)
            .eq("enabled", true),
        ]);

        // Process organization details
        if (orgResult.data) {
          setOrganizationName(orgResult.data.name);
          setPackageType(orgResult.data.package as "basic" | "extended" | "professional");
        }

        // Process settings
        if (settingsResult.data) {
          setSettings(settingsResult.data as OrganizationSettings);
        }

        // Process package info
        if (packageResult.data) {
          setPackageInfo({
            package_id: packageResult.data.package_id,
            package_name: packageResult.data.package_name,
            module_access: (packageResult.data.module_access || []) as string[],
            limits: (packageResult.data.limits as {
              max_trainees: number | null;
              max_trainers: number | null;
              max_classes: number | null;
              max_storage_mb: number | null;
            }) || {
              max_trainees: null,
              max_trainers: null,
              max_classes: null,
              max_storage_mb: null,
            },
            is_trial: packageResult.data.is_trial,
            end_date: packageResult.data.end_date,
            status: packageResult.data.status,
          });
        }

        // Process modules
        if (modulesResult.data) {
          const codes = modulesResult.data.map((m: any) => m.modules.code);
          setEnabledModules(codes);
        }

        // Cache the data
        cachedOrgData = {
          organizationId: orgId,
          organizationName: orgResult.data?.name || null,
          packageType: orgResult.data?.package as "basic" | "extended" | "professional" || null,
          settings: settingsResult.data as OrganizationSettings || null,
          userId: user.id,
        };
        hasFetched.current = true;

      } catch (error) {
        console.error("Error fetching organization:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();

    // Set up realtime subscription for settings changes
    const channel = supabase
      .channel('organization-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_settings' },
        () => {
          // Clear cache and refetch
          cachedOrgData = null;
          hasFetched.current = false;
          fetchOrganization();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, roleLoading]);

  // Apply organization theme colors dynamically
  useEffect(() => {
    const root = document.documentElement;
    
    if (organizationId && settings?.color_theme) {
      const theme = settings.color_theme;
      
      root.style.setProperty('--primary', theme.primary || '222.2 47.4% 11.2%');
      root.style.setProperty('--secondary', theme.secondary || '210 40% 96.1%');
      root.style.setProperty('--accent', theme.accent || '210 40% 96.1%');
      root.style.setProperty('--sidebar-background', theme.primary || '222.2 47.4% 11.2%');
      root.style.setProperty('--sidebar-primary', theme.secondary || '210 40% 96.1%');
      root.style.setProperty('--sidebar-accent', theme.accent || '210 40% 96.1%');
    } else if (!organizationId) {
      root.style.setProperty('--primary', '222.2 47.4% 11.2%');
      root.style.setProperty('--secondary', '210 40% 96.1%');
      root.style.setProperty('--accent', '210 40% 96.1%');
      root.style.setProperty('--sidebar-background', '222.2 47.4% 11.2%');
      root.style.setProperty('--sidebar-primary', '210 40% 96.1%');
      root.style.setProperty('--sidebar-accent', '210 40% 96.1%');
    }

    if (settings?.favicon) {
      const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = settings.favicon;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [settings, organizationId]);

  const hasModuleAccess = (moduleCode: string) => {
    if (role === "super_admin") return true;
    
    const hasPackageAccess = packageInfo 
      ? checkModuleAccess(packageInfo.module_access, moduleCode)
      : false;
    
    const hasOrgModuleAccess = enabledModules.includes(moduleCode);
    
    return hasPackageAccess || hasOrgModuleAccess;
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizationId,
        organizationName,
        package: packageType,
        packageInfo,
        settings,
        hasModuleAccess,
        loading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};
