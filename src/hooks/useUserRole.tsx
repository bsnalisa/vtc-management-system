import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "super_admin" | "organization_admin" | "admin" | "head_of_training" | "trainer" | "registration_officer" | "debtor_officer" | "hod" | "assessment_coordinator" | "stock_control_officer" | "asset_maintenance_coordinator" | "procurement_officer" | "placement_officer" | "hostel_coordinator" | "head_of_trainee_support" | "liaison_officer" | "resource_center_coordinator" | "projects_coordinator" | "hr_officer" | "bdl_coordinator" | "rpl_coordinator" | "trainee" | null;

// Cache for current user's role to avoid repeated calls
let cachedRole: UserRole = null;
let cachedUserId: string | null = null;

export const useUserRole = () => {
  const { data: role = null, isLoading: loading } = useQuery({
    queryKey: ["user_role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      // Use cached role if same user
      if (cachedUserId === user.id && cachedRole) {
        return cachedRole;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }
      
      const userRole = (data?.role as UserRole) || null;
      
      // Cache the result
      cachedUserId = user.id;
      cachedRole = userRole;
      
      return userRole;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return { role, loading };
};

// Clear role cache (call on logout)
export const clearRoleCache = () => {
  cachedRole = null;
  cachedUserId = null;
};

// Pre-set role cache (call from auth to speed up initial load)
export const setRoleCache = (userId: string, role: UserRole) => {
  cachedUserId = userId;
  cachedRole = role;
};
