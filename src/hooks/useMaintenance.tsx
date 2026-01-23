import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface MaintenanceRequest {
  id: string;
  organization_id: string;
  request_number: string;
  asset_id: string | null;
  requested_by: string;
  request_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  maintenance_type: "corrective" | "preventive" | "predictive" | "breakdown";
  status: "pending" | "approved" | "in_progress" | "on_hold" | "completed" | "cancelled";
  title: string;
  description: string;
  location: string | null;
  estimated_cost: number | null;
  approved_by: string | null;
  approved_date: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  organization_id: string;
  schedule_number: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  maintenance_type: "corrective" | "preventive" | "predictive" | "breakdown";
  frequency_type: string;
  frequency_interval: number;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  estimated_duration_hours: number | null;
  estimated_cost: number | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTask {
  id: string;
  organization_id: string;
  task_number: string;
  request_id: string | null;
  schedule_id: string | null;
  asset_id: string | null;
  assigned_to: string | null;
  assigned_by: string;
  assigned_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "approved" | "in_progress" | "on_hold" | "completed" | "cancelled";
  title: string;
  description: string | null;
  location: string | null;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  work_performed: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceMaterial {
  id: string;
  task_id: string;
  stock_item_id: string | null;
  material_name: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceCost {
  id: string;
  task_id: string;
  cost_type: string;
  supplier_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  invoice_number: string | null;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Maintenance Requests
export const useMaintenanceRequests = () => {
  return useQuery({
    queryKey: ["maintenance-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MaintenanceRequest[];
    },
  });
};

export const useCreateMaintenanceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: Omit<MaintenanceRequest, 'id' | 'created_at' | 'updated_at' | 'approved_by' | 'approved_date' | 'rejection_reason'>) => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .insert([request])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      toast.success("Maintenance request created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create request: ${error.message}`);
    },
  });
};

export const useUpdateMaintenanceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceRequest> & { id: string }) => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      toast.success("Request updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update request: ${error.message}`);
    },
  });
};

// Maintenance Schedules
export const useMaintenanceSchedules = () => {
  return useQuery({
    queryKey: ["maintenance-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .order("next_maintenance_date", { ascending: true });

      if (error) throw error;
      return data as MaintenanceSchedule[];
    },
  });
};

export const useCreateMaintenanceSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: Omit<MaintenanceSchedule, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .insert([schedule])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-schedules"] });
      toast.success("Maintenance schedule created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });
};

export const useUpdateMaintenanceSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-schedules"] });
      toast.success("Schedule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });
};

// Maintenance Tasks
export const useMaintenanceTasks = () => {
  return useQuery({
    queryKey: ["maintenance-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MaintenanceTask[];
    },
  });
};

export const useCreateMaintenanceTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<MaintenanceTask, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .insert([task])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tasks"] });
      toast.success("Maintenance task created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });
};

export const useUpdateMaintenanceTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceTask> & { id: string }) => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tasks"] });
      toast.success("Task updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });
};

// Maintenance Materials
export const useMaintenanceMaterials = (taskId: string) => {
  return useQuery({
    queryKey: ["maintenance-materials", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_materials")
        .select("*")
        .eq("task_id", taskId);

      if (error) throw error;
      return data as MaintenanceMaterial[];
    },
    enabled: !!taskId,
  });
};

export const useAddMaintenanceMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (material: Omit<MaintenanceMaterial, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from("maintenance_materials")
        .insert([material])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-materials", variables.task_id] });
      toast.success("Material added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add material: ${error.message}`);
    },
  });
};

// Maintenance Costs
export const useMaintenanceCosts = (taskId: string) => {
  return useQuery({
    queryKey: ["maintenance-costs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_costs")
        .select("*")
        .eq("task_id", taskId);

      if (error) throw error;
      return data as MaintenanceCost[];
    },
    enabled: !!taskId,
  });
};

export const useAddMaintenanceCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cost: Omit<MaintenanceCost, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("maintenance_costs")
        .insert([cost])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-costs", variables.task_id] });
      toast.success("Cost record added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add cost: ${error.message}`);
    },
  });
};
