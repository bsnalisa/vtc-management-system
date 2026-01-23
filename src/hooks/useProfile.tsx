import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProfileData {
  firstname?: string;
  surname?: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}

// Cache for current user ID to avoid repeated auth calls
let cachedUserId: string | null = null;

export const useProfile = (userId?: string) => {
  return useQuery({
    queryKey: ["profile", userId || "current"],
    queryFn: async () => {
      let targetUserId = userId;
      
      if (!targetUserId) {
        // Use cached user ID if available
        if (cachedUserId) {
          targetUserId = cachedUserId;
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          targetUserId = user?.id;
          if (targetUserId) cachedUserId = targetUserId;
        }
      }
      
      if (!targetUserId) throw new Error("No user ID provided");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - profile rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Clear cached user ID on logout
export const clearProfileCache = () => {
  cachedUserId = null;
};

// Set cached user ID (call from auth to preload)
export const setProfileUserId = (userId: string) => {
  cachedUserId = userId;
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, profileData }: { userId: string; profileData: ProfileData }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("user_id", userId)
        .select();

      if (error) throw error;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      console.error("Profile update error:", error);
      toast.error(error.message || "Failed to update profile");
    },
  });
};

export const useUploadAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile picture updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload profile picture");
    },
  });
};
