import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2, Download, GraduationCap } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  adminNavItems,
  headOfTrainingNavItems,
  hodNavItems,
  registrationOfficerNavItems,
} from "@/lib/navigationConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportUtils";


// ─── Data hook ───────────────────────────────────────────────────────────────
// Fetches org from the current user's own role row, then pulls trainers.
// Does NOT depend on useOrganizationContext so it never gets stuck waiting.
const useTrainersFromRoles = () => {
  return useQuery({
    queryKey: ["trainers_from_user_roles"],
    queryFn: async () => {
      // 0. Resolve the current user's organization_id directly
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: myRole, error: myRoleError } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (myRoleError) throw myRoleError;
      const orgId = myRole?.organization_id;
      if (!orgId) throw new Error("No organization found for current user");

      // 1. Get all user_ids with trainer role in this org
      const { data: trainerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "trainer" as any)
        .eq("organization_id", orgId);

      if (rolesError) throw rolesError;
      if (!trainerRoles || trainerRoles.length === 0) return [];

      const trainerUserIds = trainerRoles.map((r: any) => r.user_id);

      // 2. Fetch matching profiles (keyed by user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, firstname, surname, email, phone, full_name")
        .in("user_id", trainerUserIds);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      // 3. Optionally pull extra info from trainers table
      const { data: trainerRecords } = await (supabase as any)
        .from("trainers")
        .select("user_id, trainer_id, designation, employment_type, trainer_trades(trade_id, trades(id, name))")
        .in("user_id", trainerUserIds);

      const trainerMap: Record<string, any> = {};
      (trainerRecords || []).forEach((t: any) => {
        trainerMap[t.user_id] = t;
      });

      // Build final list
      return (profiles || []).map((p: any) => {
        const rec = trainerMap[p.user_id] || null;
        const resolvedName =
          `${p.firstname || ""} ${p.surname || ""}`.trim() || p.full_name || "—";
        return {
          ...p,
          full_name: resolvedName,
          trainer_record: rec,
          trainer_id: rec?.trainer_id || "—",
          designation: rec?.designation || "—",
          employment_type: rec?.employment_type || "—",
          trades:
            rec?.trainer_trades
              ?.map((tt: any) => tt.trades?.name)
              .filter(Boolean)
              .join(", ") || "—",
        };
      });
    },
    // Always enabled — resolves org internally
    enabled: true,
    retry: 2,
  });
};

// ─── Component ────────────────────────────────────────────────────────────────
const TrainerManagement = () => {
  const { role } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: trainers, isLoading, error } = useTrainersFromRoles();

  const getNavItems = () => {
    switch (role) {
      case "head_of_training":
        return headOfTrainingNavItems;
      case "hod":
        return hodNavItems;
      case "registration_officer":
        return registrationOfficerNavItems;
      default:
        return adminNavItems;
    }
  };

  const navItems = getNavItems();

  const filtered = useMemo(() => {
    if (!trainers) return [];
    const q = searchTerm.toLowerCase();
    return trainers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.trainer_id?.toLowerCase().includes(q)
    );
  }, [trainers, searchTerm]);

  const handleExport = () => {
    if (!filtered.length) return;
    exportToCSV(
      filtered.map((t) => ({
        "Trainer ID": t.trainer_id,
        "Full Name": t.full_name,
        "Email": t.email || "",
        "Phone": t.phone || "",
        "Designation": t.designation,
        "Employment Type": t.employment_type,
        "Trades": t.trades,
      })),
      `trainers-${new Date().toISOString().split("T")[0]}`
    );
  };

  return (
    <DashboardLayout
      title="Trainer Management"
      subtitle="All users assigned the trainer role"
      navItems={navItems}
      groupLabel="Training Management"
    >
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <GraduationCap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">
            Trainers are pulled directly from the system's user roles. Only users assigned the{" "}
            <strong>Trainer</strong> role appear here. To add or remove a trainer, update their
            role in <strong>User Management</strong>.
          </p>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Trainers
            </CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading…"
                : `${filtered.length} trainer${filtered.length !== 1 ? "s" : ""} found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8 text-destructive">
                <p>Failed to load trainers: {(error as Error).message}</p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading trainers…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <h3 className="text-lg font-medium">
                  {searchTerm ? "No trainers match your search" : "No trainers found"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm
                    ? "Try a different search term."
                    : "Assign the Trainer role to users via User Management."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Trainer ID</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Assigned Trades</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((trainer) => (
                    <TableRow key={trainer.id}>
                      <TableCell className="font-medium">{trainer.full_name || "—"}</TableCell>
                      <TableCell>{trainer.email || "—"}</TableCell>
                      <TableCell>{trainer.phone || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{trainer.trainer_id}</TableCell>
                      <TableCell>{trainer.designation}</TableCell>
                      <TableCell className="capitalize">
                        {trainer.employment_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>{trainer.trades}</TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TrainerManagement;
