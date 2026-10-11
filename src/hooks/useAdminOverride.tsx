import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AdminOverride {
  id: string;
  reason: string;
  started_at: string;
  expires_at: string;
}

// An Organization Admin is read-only on finance and grades unless an override is active.
// An override needs a reason, lasts a limited time and every change made during it is audited.
export const useAdminOverride = () => {
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const applies = role === "organization_admin";

  const active = useQuery({
    queryKey: ["admin-override"],
    enabled: applies,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await db
        .from("admin_overrides")
        .select("id, reason, started_at, expires_at")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] as AdminOverride | undefined) ?? null;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-override"] });

  const start = useMutation({
    mutationFn: async ({ reason, minutes }: { reason: string; minutes: number }) => {
      const { error } = await db.rpc("start_admin_override", { _reason: reason, _minutes: minutes });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const end = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("end_admin_override");
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { applies, override: active.data ?? null, start, end };
};
