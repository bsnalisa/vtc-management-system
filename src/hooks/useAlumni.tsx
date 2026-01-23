import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export const useAlumni = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: alumni, isLoading } = useQuery({
    queryKey: ["alumni", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alumni")
        .select(`
          *,
          trainees (
            trainee_id,
            first_name,
            last_name
          ),
          trades (
            name,
            code
          )
        `)
        .eq("organization_id", organizationId)
        .order("graduation_year", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createAlumni = useMutation({
    mutationFn: async (alumniData: any) => {
      const { data, error } = await supabase
        .from("alumni")
        .insert([{ ...alumniData, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni", organizationId] });
      toast.success("Alumni record created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create alumni record");
    },
  });

  const updateAlumni = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("alumni")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni", organizationId] });
      toast.success("Alumni record updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update alumni record");
    },
  });

  const deleteAlumni = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alumni")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni", organizationId] });
      toast.success("Alumni record deactivated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to deactivate alumni record");
    },
  });

  return {
    alumni,
    isLoading,
    createAlumni,
    updateAlumni,
    deleteAlumni,
  };
};

export const useAlumniEmployment = (alumniId?: string) => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: employment, isLoading } = useQuery({
    queryKey: ["alumni_employment", alumniId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alumni_employment")
        .select("*")
        .eq("alumni_id", alumniId!)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!alumniId,
  });

  const createEmployment = useMutation({
    mutationFn: async (employmentData: any) => {
      const { data, error } = await supabase
        .from("alumni_employment")
        .insert([{ ...employmentData, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni_employment"] });
      toast.success("Employment record added");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add employment record");
    },
  });

  const updateEmployment = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("alumni_employment")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni_employment"] });
      toast.success("Employment record updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update employment record");
    },
  });

  return {
    employment,
    isLoading,
    createEmployment,
    updateEmployment,
  };
};

export const useAlumniEvents = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["alumni_events", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alumni_events")
        .select("*")
        .eq("organization_id", organizationId)
        .order("event_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createEvent = useMutation({
    mutationFn: async (eventData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("alumni_events")
        .insert([{ 
          ...eventData, 
          organization_id: organizationId,
          organizer_id: user?.id 
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni_events", organizationId] });
      toast.success("Event created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create event");
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("alumni_events")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni_events", organizationId] });
      toast.success("Event updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update event");
    },
  });

  return {
    events,
    isLoading,
    createEvent,
    updateEvent,
  };
};

export const useAlumniAnnouncements = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["alumni_announcements", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alumni_announcements")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createAnnouncement = useMutation({
    mutationFn: async (announcementData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("alumni_announcements")
        .insert([{ 
          ...announcementData, 
          organization_id: organizationId,
          published_by: user?.id 
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni_announcements", organizationId] });
      toast.success("Announcement created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create announcement");
    },
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from("alumni_announcements")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumni_announcements", organizationId] });
      toast.success("Announcement updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update announcement");
    },
  });

  return {
    announcements,
    isLoading,
    createAnnouncement,
    updateAnnouncement,
  };
};
