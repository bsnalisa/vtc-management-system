import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "./useUserRole";

export const useUserRoles = () => {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRoles([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user roles:", error);
          setRoles([]);
        } else {
          setRoles(data?.map(r => r.role as UserRole) || []);
        }
      } catch (error) {
        console.error("Error:", error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();
  }, []);

  return { roles, loading, hasMultipleRoles: roles.length > 1 };
};
