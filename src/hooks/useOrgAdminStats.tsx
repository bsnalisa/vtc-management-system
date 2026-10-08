import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// Some tables are newer than the generated Supabase types, so access them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface OrgAdminStats {
  usersByRole: { role: string; count: number }[];
  totalUsers: number;
  traineesByStatus: { status: string; count: number }[];
  applicationsThisMonth: number;
  openTickets: number;
  setup: { logo: boolean; trades: number; qualifications: number; trainers: number; windows: number; leaveTypes: number; librarySettings: boolean };
}

const check = (r: { error: unknown }) => { if (r.error) throw r.error; };

export const useOrgAdminStats = () => {
  const { organizationId: org } = useOrganizationContext();
  return useQuery({
    queryKey: ["org-admin-stats", org],
    enabled: !!org,
    queryFn: async (): Promise<OrgAdminStats> => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const head = { count: "exact" as const, head: true };
      const [roles, trainees, apps, tickets, settings, trades, quals, trainers, windows, leave, lib] = await Promise.all([
        supabase.from("user_roles").select("user_id,role").eq("organization_id", org!),
        supabase.from("trainees").select("status").eq("organization_id", org!),
        supabase.from("trainee_applications").select("id", head).eq("organization_id", org!).gte("created_at", monthStart),
        supabase.from("support_tickets").select("id", head).eq("organization_id", org!).in("status", ["open", "in_progress"]),
        supabase.from("organization_settings").select("logo_url").eq("organization_id", org!).maybeSingle(),
        supabase.from("trades").select("id", head).eq("active", true).or(`organization_id.is.null,organization_id.eq.${org}`),
        supabase.from("qualifications").select("id", head).eq("organization_id", org!),
        supabase.from("trainers").select("id", head).eq("organization_id", org!),
        supabase.from("registration_windows").select("id", head).eq("organization_id", org!),
        db.from("leave_types").select("id", head).eq("organization_id", org).eq("active", true),
        db.from("library_settings").select("organization_id", head).eq("organization_id", org),
      ]);
      [roles, trainees, apps, tickets, settings, trades, quals, trainers, windows, leave, lib].forEach(check);

      const byRole = new Map<string, Set<string>>();
      const everyone = new Set<string>();
      (roles.data ?? []).forEach((r) => {
        everyone.add(r.user_id);
        if (!byRole.has(r.role)) byRole.set(r.role, new Set());
        byRole.get(r.role)!.add(r.user_id);
      });
      const byStatus = new Map<string, number>();
      (trainees.data ?? []).forEach((t) => byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1));

      return {
        usersByRole: [...byRole.entries()].map(([role, ids]) => ({ role, count: ids.size })).sort((a, b) => b.count - a.count),
        totalUsers: everyone.size,
        traineesByStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        applicationsThisMonth: apps.count ?? 0,
        openTickets: tickets.count ?? 0,
        setup: {
          logo: !!settings.data?.logo_url,
          trades: trades.count ?? 0,
          qualifications: quals.count ?? 0,
          trainers: trainers.count ?? 0,
          windows: windows.count ?? 0,
          leaveTypes: leave.count ?? 0,
          librarySettings: (lib.count ?? 0) > 0,
        },
      };
    },
  });
};
