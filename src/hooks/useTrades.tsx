import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTrades = () => {
  return useQuery({
    queryKey: ["trades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};
