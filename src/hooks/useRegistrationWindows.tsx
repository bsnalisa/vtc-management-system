import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type WindowType = "application" | "registration";

export interface RegistrationWindow {
  id: string;
  organization_id: string;
  window_type: WindowType;
  academic_year: string;
  opens_on: string;
  closes_on: string;
  created_at: string;
}

export type WindowStatus = "open" | "upcoming" | "closed";

/** Dates are plain yyyy-mm-dd strings, so compare against today's local date string. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const windowStatus = (w: Pick<RegistrationWindow, "opens_on" | "closes_on">): WindowStatus => {
  const today = todayIso();
  if (today < w.opens_on) return "upcoming";
  if (today > w.closes_on) return "closed";
  return "open";
};

export const useRegistrationWindows = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["registration-windows", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("registration_windows").select("*")
        .eq("organization_id", organizationId).order("opens_on", { ascending: false });
      if (error) throw error;
      return data as RegistrationWindow[];
    },
  });
};

export const useSaveRegistrationWindow = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (w: Partial<RegistrationWindow>) => {
      if (w.id) {
        const { id, ...patch } = w;
        const { error } = await db.from("registration_windows").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("registration_windows").insert([{ ...w, organization_id: organizationId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-windows"] });
      queryClient.invalidateQueries({ queryKey: ["open-registration-windows"] });
      toast.success("Window saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteRegistrationWindow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("registration_windows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-windows"] });
      queryClient.invalidateQueries({ queryKey: ["open-registration-windows"] });
      toast.success("Window deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
