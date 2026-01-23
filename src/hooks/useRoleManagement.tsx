import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CustomRole {
  id: string;
  role_code: string;
  role_name: string;
  description: string | null;
  is_system_role: boolean;
  organization_id: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_code: string;
  module_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModuleDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
}

// Predefined modules
export const AVAILABLE_MODULES: ModuleDefinition[] = [
  { code: "user_management", name: "User Management", description: "Manage system users", category: "Administration" },
  { code: "trainee_registration", name: "Trainee Registration", description: "Register new trainees", category: "Academic" },
  { code: "trainee_management", name: "Trainee Management", description: "View and manage trainees", category: "Academic" },
  { code: "trainer_management", name: "Trainer Management", description: "Manage trainers", category: "Academic" },
  { code: "class_management", name: "Class Management", description: "Manage classes", category: "Academic" },
  { code: "timetable_management", name: "Timetable Management", description: "Manage timetables", category: "Academic" },
  { code: "attendance_register", name: "Attendance Register", description: "Record attendance", category: "Academic" },
  { code: "assessment_results", name: "Assessment Results", description: "Manage assessment results", category: "Academic" },
  { code: "course_enrollment", name: "Course Enrollment", description: "Manage course enrollments", category: "Academic" },
  { code: "fee_management", name: "Fee Management", description: "Manage trainee fees", category: "Financial" },
  { code: "stock_management", name: "Stock Management", description: "Manage inventory", category: "Operations" },
  { code: "asset_management", name: "Asset Management", description: "Manage assets", category: "Operations" },
  { code: "procurement", name: "Procurement", description: "Purchase orders and requisitions", category: "Operations" },
  { code: "supplier_management", name: "Supplier Management", description: "Manage suppliers", category: "Operations" },
  { code: "announcements", name: "Announcements", description: "Create announcements", category: "Communication" },
  { code: "messages", name: "Messages", description: "Send and receive messages", category: "Communication" },
  { code: "analytics", name: "Analytics", description: "View analytics and reports", category: "Reporting" },
  { code: "reports", name: "Reports", description: "Generate reports", category: "Reporting" },
  { code: "document_generation", name: "Document Generation", description: "Generate documents", category: "Administration" },
];

export const useCustomRoles = (organizationId?: string) => {
  return useQuery({
    queryKey: ["custom-roles", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("custom_roles")
        .select("*, organizations(name)");

      // If organizationId provided, filter for system roles + org-specific custom roles
      if (organizationId) {
        query = query.or(`is_system_role.eq.true,organization_id.eq.${organizationId}`);
      }

      const { data, error } = await query.order("role_name");
      if (error) throw error;
      const roles = (data as CustomRole[]) ?? [];
      // Filter out invalid roles and super_admin (super_admin should never be assignable by org admins)
      return roles.filter((r) => 
        r.role_code && 
        r.role_code.trim() !== "" && 
        r.role_code !== "super_admin"
      );
    },
  });
};

export const useRolePermissions = (roleCode?: string) => {
  return useQuery({
    queryKey: ["role-permissions", roleCode],
    queryFn: async () => {
      let query = supabase.from("role_permissions").select("*");
      
      if (roleCode) {
        query = query.eq("role_code", roleCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!roleCode || roleCode === undefined,
  });
};

export const useCreateCustomRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: Omit<CustomRole, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'organization_id'> & { organization_id?: string | null }) => {
      const { data, error } = await supabase
        .from("custom_roles")
        .insert([role])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Role created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create role: ${error.message}`);
    },
  });
};

export const useUpdateCustomRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomRole> & { id: string }) => {
      const { data, error } = await supabase
        .from("custom_roles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Role updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
};

export const useDeleteCustomRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Role deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete role: ${error.message}`);
    },
  });
};

export const useUpsertRolePermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (permission: Omit<RolePermission, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("role_permissions")
        .upsert([permission], {
          onConflict: "role_code,module_code",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Permission updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update permission: ${error.message}`);
    },
  });
};

export const useDeleteRolePermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleCode, moduleCode }: { roleCode: string; moduleCode: string }) => {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_code", roleCode)
        .eq("module_code", moduleCode);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Permission removed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove permission: ${error.message}`);
    },
  });
};

// User Role Management
export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  role_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
}

export const useUsersWithRoles = (organizationId?: string) => {
  return useQuery({
    queryKey: ["users-with-roles", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select(`
          id,
          user_id,
          email,
          full_name
        `);

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      // Get user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          organization_id,
          organizations (name)
        `);

      if (rolesError) throw rolesError;

      // Get role names
      const { data: customRoles, error: customRolesError } = await supabase
        .from("custom_roles")
        .select("role_code, role_name");

      if (customRolesError) throw customRolesError;

      const roleMap = customRoles.reduce((acc, r) => {
        acc[r.role_code] = r.role_name;
        return acc;
      }, {} as Record<string, string>);

      // Combine data
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = userRoles.find((ur) => ur.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          role: userRole?.role || null,
          role_name: userRole?.role ? roleMap[userRole.role] : null,
          organization_id: userRole?.organization_id || null,
          organization_name: (userRole?.organizations as any)?.name || null,
        };
      });

      if (organizationId) {
        return usersWithRoles.filter((u) => u.organization_id === organizationId);
      }

      return usersWithRoles;
    },
  });
};

export const useBulkAssignRoles = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userIds,
      roleCode,
      organizationId,
    }: {
      userIds: string[];
      roleCode: string;
      organizationId?: string;
    }) => {
      // First, delete existing role assignments for these users
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .in("user_id", userIds);

      if (deleteError) throw deleteError;

      // Then insert new role assignments
      const roleAssignments = userIds.map((userId) => ({
        user_id: userId,
        role: roleCode as any, // Cast to any to bypass strict type checking for custom roles
        organization_id: organizationId || null,
      }));

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert(roleAssignments);

      if (insertError) throw insertError;

      return roleAssignments;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(`Successfully assigned role to ${variables.userIds.length} user(s)`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign roles: ${error.message}`);
    },
  });
};