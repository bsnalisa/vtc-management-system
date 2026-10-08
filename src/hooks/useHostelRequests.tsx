import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import type { AffairsRecord } from "./useTraineeAffairs";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AvailableHostelRoom {
  room_id: string; building_name: string; room_number: string; floor_number: number | null;
  room_type: string; capacity: number; free_beds: number; monthly_fee: number | null; amenities: string[] | null;
}

export type HostelRequestStatus = "requested" | "approved" | "rejected" | "cancelled";

export interface HostelRoomRequest {
  id: string; trainee_id: string; room_id: string; status: HostelRequestStatus;
  note: string | null; decision_notes: string | null; decided_at: string | null; created_at: string;
  hostel_rooms?: { room_number: string; hostel_buildings?: { building_name: string } | null } | null;
  trainees?: { first_name: string; last_name: string; trainee_id: string; gender: string | null } | null;
}

export type HostelComplaint = AffairsRecord;

export const useAvailableHostelRooms = (enabled = true) =>
  useQuery({
    queryKey: ["hostel-available-rooms"], enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("list_available_hostel_rooms");
      if (error) throw error;
      return data as AvailableHostelRoom[];
    },
  });

export const useMyHostelRequests = (traineeId: string | undefined) =>
  useQuery({
    queryKey: ["my-hostel-requests", traineeId], enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.from("hostel_room_requests")
        .select("*, hostel_rooms(room_number, hostel_buildings(building_name))")
        .eq("trainee_id", traineeId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as HostelRoomRequest[];
    },
  });

export const useRequestHostelRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ room, note }: { room: string; note?: string }) => {
      const { error } = await db.rpc("request_hostel_room", { _room: room, _note: note?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-hostel-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hostel-available-rooms"] });
      toast.success("Room request sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useCancelHostelRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("cancel_hostel_room_request", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-hostel-requests"] });
      toast.success("Request cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useHostelRequestsAdmin = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hostel-room-requests", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("hostel_room_requests")
        .select("*, hostel_rooms(room_number, hostel_buildings(building_name)), trainees(first_name,last_name,trainee_id,gender)")
        .eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as HostelRoomRequest[];
    },
  });
};

export const useDecideHostelRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve, notes }: { id: string; approve: boolean; notes?: string }) => {
      const { error } = await db.rpc("decide_hostel_room_request", { _id: id, _approve: approve, _notes: notes?.trim() || null });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => {
      ["hostel-room-requests", "hostel-allocations", "hostel-beds", "hostel-rooms", "hostel-buildings"]
        .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(approve ? "Request approved and bed allocated" : "Request declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useHostelComplaints = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hostel-complaints", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("trainee_affairs_records")
        .select("*, trainees(first_name,last_name,trainee_id)")
        .eq("organization_id", organizationId).eq("category", "hostel")
        .order("record_date", { ascending: false });
      if (error) throw error;
      return data as HostelComplaint[];
    },
  });
};

export const useUpdateHostelComplaint = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, action_taken }: { id: string; status: HostelComplaint["status"]; action_taken: string | null }) => {
      const { error } = await db.from("trainee_affairs_records").update({ status, action_taken }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["affairs-records"] });
      toast.success("Complaint updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
