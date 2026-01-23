import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSuperAdminStats = () => {
  return useQuery({
    queryKey: ["super_admin_stats"],
    queryFn: async () => {
      // Get all organizations
      const { data: organizations } = await supabase
        .from("organizations")
        .select("id, active, created_at");

      const totalOrgs = organizations?.length || 0;
      const activeOrgs = organizations?.filter((org) => org.active).length || 0;

      // Get total users across all organizations
      const { count: totalUsers } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true });

      // Get total trainees across all organizations
      const { count: totalTrainees } = await supabase
        .from("trainees")
        .select("*", { count: "exact", head: true });

      // Get total trainers across all organizations
      const { count: totalTrainers } = await supabase
        .from("trainers")
        .select("*", { count: "exact", head: true });

      // Get package distribution with names
      const { data: packageData } = await supabase
        .from("organization_packages")
        .select(`
          status,
          is_trial,
          packages (name)
        `)
        .eq("status", "active");

      const activePackages = packageData?.length || 0;
      const trialPackages = packageData?.filter((p) => p.is_trial).length || 0;

      // Calculate package distribution by name
      const packageDistribution: Record<string, number> = {};
      packageData?.forEach((p) => {
        const name = (p.packages as any)?.name || "Unknown";
        packageDistribution[name] = (packageDistribution[name] || 0) + 1;
      });

      // Get hostel statistics - rooms and occupancy
      const { data: hostelRooms } = await supabase
        .from("hostel_rooms")
        .select("id, capacity, current_occupancy");

      const totalRooms = hostelRooms?.length || 0;
      const totalCapacity = hostelRooms?.reduce((sum, r) => sum + (r.capacity || 0), 0) || 0;
      const currentOccupancy = hostelRooms?.reduce((sum, r) => sum + (r.current_occupancy || 0), 0) || 0;
      const occupancyRate = totalCapacity > 0 ? Math.round((currentOccupancy / totalCapacity) * 100) : 0;

      // Get active hostel allocations
      const { count: totalAllocations } = await supabase
        .from("hostel_allocations")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get asset statistics
      const { count: totalAssets } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Get stock categories count
      const { count: totalStockCategories } = await supabase
        .from("stock_categories")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Get stock items count
      const { count: totalStockItems } = await supabase
        .from("stock_items")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Get recent notifications
      const { count: unreadNotifications } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);

      // Get billing/revenue data
      const { data: billingData } = await supabase
        .from("billing_records")
        .select("amount, status, payment_date, created_at");

      const totalRevenue = billingData?.filter(b => b.status === "paid").reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
      const pendingPayments = billingData?.filter(b => b.status === "pending").reduce((sum, b) => sum + (b.amount || 0), 0) || 0;

      // Calculate monthly growth data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyGrowth = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const orgsInMonth = organizations?.filter(org => {
          const createdAt = new Date(org.created_at);
          return createdAt <= monthEnd;
        }).length || 0;

        monthlyGrowth.push({
          month: months[date.getMonth()],
          organizations: orgsInMonth,
          users: Math.round(orgsInMonth * ((totalUsers || 0) / Math.max(totalOrgs, 1))),
        });
      }

      return {
        totalOrgs,
        activeOrgs,
        totalUsers: totalUsers || 0,
        totalTrainees: totalTrainees || 0,
        totalTrainers: totalTrainers || 0,
        activePackages,
        trialPackages,
        packageDistribution,
        totalRooms,
        totalCapacity,
        currentOccupancy,
        occupancyRate,
        totalAllocations: totalAllocations || 0,
        totalAssets: totalAssets || 0,
        totalStockCategories: totalStockCategories || 0,
        totalStockItems: totalStockItems || 0,
        unreadNotifications: unreadNotifications || 0,
        totalRevenue,
        pendingPayments,
        monthlyGrowth,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};
