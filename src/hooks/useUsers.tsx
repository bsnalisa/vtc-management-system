import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserRoleData {
  email: string;
  password: string;
  firstname: string;
  surname: string;
  role: string; // Dynamic role code from custom_roles table
  phone?: string;
}

export const useUsers = (organizationId?: string) => {
  return useQuery({
    queryKey: ["users", organizationId],
    queryFn: async () => {
      // First get all profiles (RLS will filter based on user's permissions)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Then get roles and organization for each user
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          let query = supabase
            .from("user_roles")
            .select(`
              id,
              role,
              organization_id,
              organizations (
                name
              )
            `)
            .eq("user_id", profile.user_id);
          
          // Filter by organization if specified
          if (organizationId) {
            query = query.eq("organization_id", organizationId);
          }
          
          const { data: roles } = await query;
          
          return {
            ...profile,
            user_roles: roles || [],
          };
        })
      );

      // Filter out users with no roles if organizationId is specified
      if (organizationId) {
        return usersWithRoles.filter(user => user.user_roles.length > 0);
      }

      return usersWithRoles;
    },
  });
};

export const useCreateUser = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: UserRoleData & { organization_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Use edge function to create user (doesn't affect current session)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          firstname: userData.firstname,
          surname: userData.surname,
          phone: userData.phone,
          role: userData.role,
          organization_id: userData.organization_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      return result.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: "User created successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteUser = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useAddUserRole = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role, organizationId }: { userId: string; role: any; organizationId?: string }) => {
      const { data, error } = await supabase
        .from("user_roles")
        .insert([{
          user_id: userId,
          role: role as any,
          organization_id: organizationId || null,
        }])
        .select();

      if (error) throw error;
      
      // Verify the insert was successful
      if (!data || data.length === 0) {
        throw new Error("Role assignment returned no data");
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: "Role added successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Add role error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRemoveUserRole = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: "Role removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export interface UpdateUserData {
  userId: string;
  firstname?: string;
  surname?: string;
  phone?: string;
  role?: string;
  active?: boolean;
  organization_id?: string;
}

export const useUpdateUser = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: UpdateUserData) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: "User updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeactivateUser = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, active }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user status');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: variables.active ? "User reactivated successfully" : "User deactivated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateUserOrganization = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      oldOrganizationId, 
      newOrganizationId 
    }: { 
      userId: string; 
      oldOrganizationId: string | null; 
      newOrganizationId: string | null;
    }) => {
      // First, get the user's roles to avoid updating super_admin roles
      const { data: userRoles, error: fetchError } = await supabase
        .from("user_roles")
        .select("id, role")
        .eq("user_id", userId);

      if (fetchError) throw fetchError;

      // Filter out super_admin roles
      const roleIdsToUpdate = userRoles
        ?.filter(ur => ur.role !== 'super_admin')
        .map(ur => ur.id) || [];

      if (roleIdsToUpdate.length === 0) {
        return { userId, newOrganizationId };
      }

      // Update only non-super_admin roles
      const { data, error } = await supabase
        .from("user_roles")
        .update({ organization_id: newOrganizationId })
        .in("id", roleIdsToUpdate)
        .select();

      if (error) throw error;

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc("log_audit_event", {
          _action: "user_organization_changed",
          _table_name: "user_roles",
          _record_id: userId,
          _old_data: { organization_id: oldOrganizationId },
          _new_data: { organization_id: newOrganizationId },
        });
      }

      return { userId, newOrganizationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Success",
        description: "User organization updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Update organization error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
