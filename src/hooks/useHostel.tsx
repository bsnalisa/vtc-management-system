import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import { Database } from "@/integrations/supabase/types";

type HostelBuilding = Database['public']['Tables']['hostel_buildings']['Row'];
type HostelRoom = Database['public']['Tables']['hostel_rooms']['Row'];
type HostelBed = Database['public']['Tables']['hostel_beds']['Row'];
type HostelAllocation = Database['public']['Tables']['hostel_allocations']['Row'];
type HostelFee = Database['public']['Tables']['hostel_fees']['Row'];
type HostelMaintenanceIssue = Database['public']['Tables']['hostel_maintenance_issues']['Row'];

type NewHostelBuilding = Database['public']['Tables']['hostel_buildings']['Insert'];
type NewHostelRoom = Database['public']['Tables']['hostel_rooms']['Insert'];
type NewHostelBed = Database['public']['Tables']['hostel_beds']['Insert'];
type NewHostelAllocation = Database['public']['Tables']['hostel_allocations']['Insert'];
type NewHostelFee = Database['public']['Tables']['hostel_fees']['Insert'];
type NewHostelMaintenanceIssue = Database['public']['Tables']['hostel_maintenance_issues']['Insert'];

type UpdateHostelBuilding = Database['public']['Tables']['hostel_buildings']['Update'];
type UpdateHostelRoom = Database['public']['Tables']['hostel_rooms']['Update'];
type UpdateHostelAllocation = Database['public']['Tables']['hostel_allocations']['Update'];
type UpdateHostelMaintenanceIssue = Database['public']['Tables']['hostel_maintenance_issues']['Update'];

// Hostel Buildings Hooks
export const useHostelBuildings = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-buildings", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hostel_buildings")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("building_name");

      if (error) throw error;
      return data as HostelBuilding[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateHostelBuilding = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (building: Omit<NewHostelBuilding, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("hostel_buildings")
        .insert({ ...building, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-buildings"] });
      toast.success("Building created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create building: ${error.message}`);
    },
  });
};

export const useUpdateHostelBuilding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateHostelBuilding & { id: string }) => {
      const { data, error } = await supabase
        .from("hostel_buildings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-buildings"] });
      toast.success("Building updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update building: ${error.message}`);
    },
  });
};

// Hostel Rooms Hooks
export const useHostelRooms = (buildingId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-rooms", organizationId, buildingId],
    queryFn: async () => {
      let query = supabase
        .from("hostel_rooms")
        .select("*, hostel_buildings(building_name)")
        .eq("organization_id", organizationId!);

      if (buildingId) {
        query = query.eq("building_id", buildingId);
      }

      const { data, error } = await query.order("room_number");

      if (error) throw error;
      return data as (HostelRoom & { hostel_buildings: { building_name: string } })[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateHostelRoom = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (room: Omit<NewHostelRoom, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("hostel_rooms")
        .insert({ ...room, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-buildings"] });
      toast.success("Room created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create room: ${error.message}`);
    },
  });
};

export const useUpdateHostelRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateHostelRoom & { id: string }) => {
      const { data, error } = await supabase
        .from("hostel_rooms")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-rooms"] });
      toast.success("Room updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update room: ${error.message}`);
    },
  });
};

// Hostel Beds Hooks
export const useHostelBeds = (roomId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-beds", organizationId, roomId],
    queryFn: async () => {
      let query = supabase
        .from("hostel_beds")
        .select("*, hostel_rooms(room_number, hostel_buildings(building_name))")
        .eq("organization_id", organizationId!);

      if (roomId) {
        query = query.eq("room_id", roomId);
      }

      const { data, error } = await query.order("bed_number");

      if (error) throw error;
      return data as HostelBed[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateHostelBeds = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (beds: Omit<NewHostelBed, 'organization_id'>[]) => {
      const bedsWithOrg = beds.map(bed => ({ ...bed, organization_id: organizationId! }));
      const { data, error } = await supabase
        .from("hostel_beds")
        .insert(bedsWithOrg)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-beds"] });
      toast.success("Beds created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create beds: ${error.message}`);
    },
  });
};

// Hostel Allocations Hooks
export const useHostelAllocations = (filters?: { status?: Database['public']['Enums']['allocation_status']; trainee_id?: string }) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-allocations", organizationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("hostel_allocations")
        .select(`
          *,
          hostel_beds(bed_number),
          hostel_rooms(room_number),
          hostel_buildings(building_name)
        `)
        .eq("organization_id", organizationId!);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.trainee_id) {
        query = query.eq("trainee_id", filters.trainee_id);
      }

      const { data, error } = await query.order("check_in_date", { ascending: false });

      if (error) throw error;
      return data as HostelAllocation[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateHostelAllocation = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (allocation: Omit<NewHostelAllocation, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("hostel_allocations")
        .insert({ ...allocation, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-beds"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-buildings"] });
      toast.success("Room allocated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to allocate room: ${error.message}`);
    },
  });
};

export const useCheckOutHostelAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checked_out_by }: { id: string; checked_out_by: string }) => {
      const { data, error } = await supabase
        .from("hostel_allocations")
        .update({ 
          status: 'checked_out',
          actual_check_out_date: new Date().toISOString().split('T')[0],
          checked_out_by
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-beds"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-buildings"] });
      toast.success("Check-out completed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to check out: ${error.message}`);
    },
  });
};

// Hostel Fees Hooks
export const useHostelFees = (filters?: { payment_status?: string; trainee_id?: string }) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-fees", organizationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("hostel_fees")
        .select("*")
        .eq("organization_id", organizationId!);

      if (filters?.payment_status) {
        query = query.eq("payment_status", filters.payment_status);
      }

      if (filters?.trainee_id) {
        query = query.eq("trainee_id", filters.trainee_id);
      }

      const { data, error } = await query.order("fee_month", { ascending: false });

      if (error) throw error;
      return data as HostelFee[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateHostelFee = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (fee: Omit<NewHostelFee, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("hostel_fees")
        .insert({ ...fee, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-fees"] });
      toast.success("Hostel fee created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create fee: ${error.message}`);
    },
  });
};

export const usePayHostelFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data: fee } = await supabase
        .from("hostel_fees")
        .select("amount_paid")
        .eq("id", id)
        .single();

      const newAmountPaid = (fee?.amount_paid || 0) + amount;

      const { data, error } = await supabase
        .from("hostel_fees")
        .update({ amount_paid: newAmountPaid })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-fees"] });
      toast.success("Payment recorded successfully");
    },
    onError: (error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
};

// Hostel Maintenance Hooks
export const useHostelMaintenanceIssues = (filters?: { status?: Database['public']['Enums']['hostel_maintenance_status']; building_id?: string }) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-maintenance", organizationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("hostel_maintenance_issues")
        .select(`
          *,
          hostel_buildings(building_name),
          hostel_rooms(room_number)
        `)
        .eq("organization_id", organizationId!);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.building_id) {
        query = query.eq("building_id", filters.building_id);
      }

      const { data, error } = await query.order("reported_date", { ascending: false });

      if (error) throw error;
      return data as HostelMaintenanceIssue[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateHostelMaintenanceIssue = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (issue: Omit<NewHostelMaintenanceIssue, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("hostel_maintenance_issues")
        .insert({ ...issue, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-maintenance"] });
      toast.success("Maintenance issue reported successfully");
    },
    onError: (error) => {
      toast.error(`Failed to report issue: ${error.message}`);
    },
  });
};

export const useUpdateHostelMaintenanceIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateHostelMaintenanceIssue & { id: string }) => {
      const { data, error } = await supabase
        .from("hostel_maintenance_issues")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-maintenance"] });
      toast.success("Maintenance issue updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update issue: ${error.message}`);
    },
  });
};
