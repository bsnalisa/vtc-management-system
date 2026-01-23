import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MessageData {
  receiver_id: string;
  subject: string;
  message: string;
}

export const useMessages = (type: "inbox" | "sent" = "inbox") => {
  return useQuery({
    queryKey: ["messages", type],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const query = supabase
        .from("messages")
        .select(`
          *,
          sender:sender_id(id, email, profiles(full_name)),
          receiver:receiver_id(id, email, profiles(full_name))
        `)
        .order("created_at", { ascending: false });

      if (type === "inbox") {
        query.eq("receiver_id", user.id);
      } else {
        query.eq("sender_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useSendMessage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageData: MessageData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("messages")
        .insert([{
          ...messageData,
          sender_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // Create notification for receiver
      await supabase.from("notifications").insert({
        user_id: messageData.receiver_id,
        type: "message",
        title: "New Message",
        message: `You have a new message: ${messageData.subject}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast({
        title: "Success",
        description: "Message sent successfully!",
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

export const useMarkMessageRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ read: true })
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
};

export const useUnreadMessageCount = () => {
  return useQuery({
    queryKey: ["unread_messages_count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);

      return count || 0;
    },
  });
};
