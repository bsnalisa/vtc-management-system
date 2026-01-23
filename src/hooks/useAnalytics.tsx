import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSuperAdminAnalytics = () => {
  return useQuery({
    queryKey: ["super_admin_analytics"],
    queryFn: async () => {
      // Total organizations
      const { count: totalOrgs } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true });

      // Active organizations
      const { count: activeOrgs } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Package usage
      const { data: packageUsage } = await supabase
        .from("organization_packages")
        .select(`
          package_id,
          packages(name),
          organization_id
        `)
        .eq("status", "active");

      // Count by package
      const packageCounts = packageUsage?.reduce((acc: any, curr: any) => {
        const packageName = curr.packages?.name || "Unknown";
        acc[packageName] = (acc[packageName] || 0) + 1;
        return acc;
      }, {});

      // Recent activity (audit logs)
      const { data: recentActivity } = await supabase
        .from("system_audit_logs")
        .select(`
          action,
          created_at,
          user:user_id(email, profiles(full_name))
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        totalOrganizations: totalOrgs || 0,
        activeOrganizations: activeOrgs || 0,
        totalUsers: totalUsers || 0,
        packageUsage: packageCounts || {},
        recentActivity: recentActivity || [],
      };
    },
  });
};

export const useOrganizationAnalytics = (organizationId: string) => {
  return useQuery({
    queryKey: ["organization_analytics", organizationId],
    queryFn: async () => {
      // Total trainees in organization
      const { count: totalTrainees } = await supabase
        .from("trainees")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      // Total trainers
      const { count: totalTrainers } = await supabase
        .from("trainers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);

      // Total classes
      const { count: totalClasses } = await supabase
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);

      // Fee collection stats
      const { data: feeData } = await supabase
        .from("fee_records")
        .select("total_fee, amount_paid, balance")
        .eq("organization_id", organizationId);

      const totalFees = feeData?.reduce((sum, record) => sum + Number(record.total_fee), 0) || 0;
      const totalCollected = feeData?.reduce((sum, record) => sum + Number(record.amount_paid), 0) || 0;
      const totalOutstanding = feeData?.reduce((sum, record) => sum + Number(record.balance), 0) || 0;

      return {
        totalTrainees: totalTrainees || 0,
        totalTrainers: totalTrainers || 0,
        totalClasses: totalClasses || 0,
        totalFees,
        totalCollected,
        totalOutstanding,
        collectionRate: totalFees > 0 ? ((totalCollected / totalFees) * 100).toFixed(1) : "0",
      };
    },
  });
};
