import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Module {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: string;
  active: boolean;
}

export const useModules = (activeOnly: boolean = true) => {
  return useQuery({
    queryKey: ["modules", activeOnly],
    queryFn: async () => {
      let query = supabase
        .from("modules")
        .select("*")
        .order("name");

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Module[];
    },
  });
};

export const useOrganizationModules = (organizationId: string | null) => {
  return useQuery({
    queryKey: ["organization-modules", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("organization_modules")
        .select(`
          *,
          modules (*)
        `)
        .eq("organization_id", organizationId)
        .eq("enabled", true);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};
