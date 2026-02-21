import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2, Download, GraduationCap, Pencil, UserX, MoreHorizontal } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportUtils";
import { TrainerEditDialog } from "@/components/trainers/TrainerEditDialog";
import { TrainerDeactivateDialog } from "@/components/trainers/TrainerDeactivateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Data hook ───────────────────────────────────────────────────────────────
const useTrainersFromRoles = () => {
  return useQuery({
    queryKey: ["trainers_from_user_roles"],
    queryFn: async () => {
      // Step 1: get all user_ids with role = trainer
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, organization_id")
        .eq("role", "trainer" as any);

      if (rolesError) throw rolesError;
      if (!roleRows || roleRows.length === 0) return [];

      const userIds = roleRows.map((r: any) => r.user_id as string);

      // Step 2: fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, firstname, surname, full_name, email, phone")
        .in("user_id", userIds);
      if (profilesError) throw profilesError;

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      // Step 3: fetch trainers table for metadata (designation, employment_type, trainer_id)
      const { data: trainerRows } = await (supabase as any)
        .from("trainers")
        .select("id, trainer_id, full_name, designation, employment_type, active, email, organization_id");

      const trainerByEmail: Record<string, any> = {};
      const trainerByName: Record<string, any> = {};
      (trainerRows || []).forEach((t: any) => {
        if (t.email) trainerByEmail[t.email.toLowerCase()] = t;
        if (t.full_name) trainerByName[t.full_name.toLowerCase()] = t;
      });

      // Step 4: fetch trainer_trades for all trainers
      const trainerTableIds = (trainerRows || []).map((t: any) => t.id);
      let tradeMap: Record<string, string[]> = {};
      let tradeNameMap: Record<string, string[]> = {};
      if (trainerTableIds.length > 0) {
        const { data: ttRows } = await (supabase as any)
          .from("trainer_trades")
          .select("trainer_id, trade_id, trades(name)")
          .in("trainer_id", trainerTableIds);
        (ttRows || []).forEach((tt: any) => {
          if (!tradeMap[tt.trainer_id]) {
            tradeMap[tt.trainer_id] = [];
            tradeNameMap[tt.trainer_id] = [];
          }
          tradeMap[tt.trainer_id].push(tt.trade_id);
          tradeNameMap[tt.trainer_id].push(tt.trades?.name || tt.trade_id);
        });
      }

      return roleRows.map((r: any) => {
        const p = profileMap[r.user_id] || {};
        const email = p.email || "";
        const fullName = `${p.firstname || ""} ${p.surname || ""}`.trim() || p.full_name || email || "—";

        // Match to trainers table by email or name
        const trainerRecord = trainerByEmail[email.toLowerCase()] || trainerByName[fullName.toLowerCase()] || null;

        return {
          user_id: r.user_id,
          organization_id: r.organization_id,
          firstname: p.firstname || "",
          surname: p.surname || "",
          full_name: fullName,
          email: email || "—",
          phone: p.phone || "—",
          trainer_table_id: trainerRecord?.id || undefined,
          trainer_id: trainerRecord?.trainer_id || "—",
          designation: trainerRecord?.designation || "—",
          employment_type: trainerRecord?.employment_type || "—",
          active: trainerRecord?.active ?? true,
          assigned_trade_ids: trainerRecord ? (tradeMap[trainerRecord.id] || []) : [],
          trades: trainerRecord ? (tradeNameMap[trainerRecord.id] || []).join(", ") || "—" : "—",
        };
      });
    },
    enabled: true,
  });
};

// ─── Component ────────────────────────────────────────────────────────────────
const TrainerManagement = () => {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTrainer, setEditingTrainer] = useState<any>(null);
  const [deactivatingTrainer, setDeactivatingTrainer] = useState<any>(null);

  const { data: trainers, isLoading, error } = useTrainersFromRoles();

  const canManage = role === "head_of_training" || role === "admin" || role === "organization_admin" || role === "super_admin";

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
      groupLabel={groupLabel}
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
            Trainers are pulled from system user roles. Use the <strong>Actions</strong> menu to
            edit details, assign trades, or deactivate trainers. To add a new trainer, assign the
            Trainer role in <strong>User Management</strong>.
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
                    {canManage && <TableHead className="w-12">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((trainer) => (
                    <TableRow key={trainer.user_id}>
                      <TableCell className="font-medium">{trainer.full_name || "—"}</TableCell>
                      <TableCell>{trainer.email || "—"}</TableCell>
                      <TableCell>{trainer.phone || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{trainer.trainer_id}</TableCell>
                      <TableCell>{trainer.designation}</TableCell>
                      <TableCell className="capitalize">
                        {trainer.employment_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={trainer.trades}>
                        {trainer.trades}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingTrainer(trainer)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeactivatingTrainer(trainer)}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TrainerEditDialog
        open={!!editingTrainer}
        onOpenChange={(open) => { if (!open) setEditingTrainer(null); }}
        trainer={editingTrainer}
      />
      <TrainerDeactivateDialog
        open={!!deactivatingTrainer}
        onOpenChange={(open) => { if (!open) setDeactivatingTrainer(null); }}
        trainer={deactivatingTrainer}
      />
    </DashboardLayout>
  );
};

export default TrainerManagement;
