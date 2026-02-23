import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface TrainingBuilding {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  building_trades?: { id: string; trade_id: string; trades: { id: string; name: string; code: string } }[];
}

export interface TrainingRoom {
  id: string;
  building_id: string;
  organization_id: string;
  name: string;
  code: string;
  room_type: "classroom" | "lab" | "workshop";
  capacity: number | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  training_buildings?: { id: string; name: string; code: string };
}

// Fetch all training buildings
export const useTrainingBuildings = () => {
  return useQuery({
    queryKey: ["training_buildings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_buildings")
        .select(`
          *,
          building_trades (
            id,
            trade_id,
            trades:trade_id (id, name, code)
          )
        `)
        .order("name");
      if (error) throw error;
      return data as TrainingBuilding[];
    },
  });
};

// Create building
export const useCreateBuilding = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: { name: string; code: string; description?: string; location?: string; trade_ids?: string[] }) => {
      const { trade_ids, ...buildingData } = data;
      const { data: building, error } = await supabase
        .from("training_buildings")
        .insert([{ ...buildingData, organization_id: organizationId }])
        .select()
        .maybeSingle();
      if (error) throw error;

      if (trade_ids?.length && building) {
        const { error: tradeError } = await supabase
          .from("building_trades")
          .insert(trade_ids.map(trade_id => ({ building_id: building.id, trade_id })));
        if (tradeError) throw tradeError;
      }
      return building;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_buildings"] });
      toast({ title: "Success", description: "Building created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Update building
export const useUpdateBuilding = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, trade_ids, ...data }: { id: string; name: string; code: string; description?: string; location?: string; trade_ids?: string[] }) => {
      const { error } = await supabase
        .from("training_buildings")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Replace trade assignments
      if (trade_ids !== undefined) {
        await supabase.from("building_trades").delete().eq("building_id", id);
        if (trade_ids.length) {
          const { error: tradeError } = await supabase
            .from("building_trades")
            .insert(trade_ids.map(trade_id => ({ building_id: id, trade_id })));
          if (tradeError) throw tradeError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_buildings"] });
      toast({ title: "Success", description: "Building updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Delete building
export const useDeleteBuilding = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_buildings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_buildings"] });
      queryClient.invalidateQueries({ queryKey: ["training_rooms"] });
      toast({ title: "Success", description: "Building deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Fetch all training rooms
export const useTrainingRooms = (buildingId?: string) => {
  return useQuery({
    queryKey: ["training_rooms", buildingId],
    queryFn: async () => {
      let query = supabase
        .from("training_rooms")
        .select(`
          *,
          training_buildings:building_id (id, name, code)
        `)
        .order("name");
      if (buildingId) query = query.eq("building_id", buildingId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TrainingRoom[];
    },
  });
};

// Create room
export const useCreateRoom = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: { building_id: string; name: string; code: string; room_type: string; capacity?: number; description?: string }) => {
      const { data: room, error } = await supabase
        .from("training_rooms")
        .insert([{ ...data, room_type: data.room_type as any, organization_id: organizationId }])
        .select()
        .maybeSingle();
      if (error) throw error;
      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_rooms"] });
      toast({ title: "Success", description: "Room created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Update room
export const useUpdateRoom = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; building_id: string; name: string; code: string; room_type: string; capacity?: number; description?: string }) => {
      const { error } = await supabase
        .from("training_rooms")
        .update({ ...data, room_type: data.room_type as any, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_rooms"] });
      toast({ title: "Success", description: "Room updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Delete room
export const useDeleteRoom = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_rooms"] });
      toast({ title: "Success", description: "Room deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
