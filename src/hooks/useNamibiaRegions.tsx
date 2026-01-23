import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useNamibiaRegions = () => {
  return useQuery({
    queryKey: ["namibia_regions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("namibia_regions")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};
