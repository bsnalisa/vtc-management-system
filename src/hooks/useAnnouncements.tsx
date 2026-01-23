import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AnnouncementData {
  title: string;
  content: string;
  priority: string;
  target_roles?: ("admin" | "assessment_coordinator" | "debtor_officer" | "hod" | "registration_officer" | "trainer")[];
  expires_at?: string;
}

export const useAnnouncements = () => {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateAnnouncement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementData: AnnouncementData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("announcements")
        .insert([{
          ...announcementData,
          published_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // Create notifications for target roles
      if (announcementData.target_roles && announcementData.target_roles.length > 0) {
        // Get users with target roles
        const { data: targetUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", announcementData.target_roles);

        if (targetUsers && targetUsers.length > 0) {
          // Create notifications for each user
          const notifications = targetUsers.map(u => ({
            user_id: u.user_id,
            type: "announcement",
            title: announcementData.title,
            message: announcementData.content.substring(0, 200),
          }));

          await supabase.from("notifications").insert(notifications);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({
        title: "Success",
        description: "Announcement published!",
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
