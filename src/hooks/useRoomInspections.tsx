import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface RoomInspection {
  id: string;
  organization_id: string;
  room_id: string;
  inspection_date: string;
  inspector_id: string;
  cleanliness_rating: number;
  condition_rating: number;
  safety_rating: number;
  overall_rating: number;
  issues_found: string | null;
  recommendations: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  status: string;
  created_at: string;
  hostel_rooms?: { 
    room_number: string;
    hostel_buildings?: { building_name: string };
  };
}

export interface CreateInspectionData {
  room_id: string;
  inspection_date: string;
  cleanliness_rating: number;
  condition_rating: number;
  safety_rating: number;
  issues_found?: string;
  recommendations?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
}

export const useRoomInspections = (roomId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["room-inspections", organizationId, roomId],
    queryFn: async () => {
      let query = supabase
        .from("room_inspections")
        .select(`
          *,
          hostel_rooms (room_number, hostel_buildings (building_name))
        `)
        .order("inspection_date", { ascending: false });

      if (roomId) {
        query = query.eq("room_id", roomId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RoomInspection[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateRoomInspection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreateInspectionData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      const { data: inspection, error } = await supabase
        .from("room_inspections")
        .insert({
          organization_id: organizationId,
          inspector_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return inspection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-inspections"] });
      toast({ title: "Inspection recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useInspectionsDueForFollowUp = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["inspections-follow-up", organizationId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("room_inspections")
        .select(`
          *,
          hostel_rooms (room_number, hostel_buildings (building_name))
        `)
        .eq("follow_up_required", true)
        .lte("follow_up_date", today)
        .eq("status", "completed");

      if (error) throw error;
      return data as RoomInspection[];
    },
    enabled: !!organizationId,
  });
};
