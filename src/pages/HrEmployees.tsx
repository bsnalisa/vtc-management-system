import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { ExportMenu } from "@/components/ExportMenu";
import { StaffEditDialog } from "@/components/hr/StaffEditDialog";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { StaffMember, fmtDate, labelOf, useStaffDirectory } from "@/hooks/useHr";

const HrEmployees = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useStaffDirectory();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const departments = useMemo(() => Array.from(new Set((data ?? []).map((s) => s.department).filter(Boolean) as string[])).sort(), [data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((s) =>
      (department === "all" || s.department === department || (department === "none" && !s.department)) &&
      (status === "all" || (s.employment_status ?? "no_record") === status) &&
      (!q || [s.full_name, s.email, s.employee_number, s.job_title, s.roles].some((v) => v?.toLowerCase().includes(q))));
  }, [data, search, department, status]);

  const exportRows = () => rows.map((s) => ({
    Name: s.full_name ?? "", Email: s.email ?? "", Roles: s.roles ?? "", "Employee number": s.employee_number ?? "", "Job title": s.job_title ?? "",
    Department: s.department ?? "", "Employment type": labelOf(s.employment_type), "Employment status": s.employment_status ? labelOf(s.employment_status) : "No HR record",
    "Start date": s.start_date ?? "", "On leave today": s.on_leave_today ? "Yes" : "No",
  }));

  return (
    <DashboardLayout title="Staff Directory" subtitle="Everyone with a staff role in the centre and their HR record" navItems={navItems} groupLabel={groupLabel}>
      <Card className="border-0 shadow-md">
        <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
          <div><CardTitle>Staff</CardTitle><CardDescription>{rows.length} of {data?.length ?? 0} shown</CardDescription></div>
          <ExportMenu data={exportRows} filename="staff-directory" title="Staff Directory" disabled={!rows.length} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Search name, email, number, title" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="sm:w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem><SelectItem value="none">No department</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["active", "on_leave", "suspended", "resigned", "terminated", "no_record"].map((s) => <SelectItem key={s} value={s}>{s === "no_record" ? "No HR record" : labelOf(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoading && <LoadingSpinner text="Loading staff" />}
          {error && <p role="alert" className="text-sm text-destructive">Could not load the staff directory: {(error as Error).message}</p>}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Job title</TableHead><TableHead>Department</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell>{s.full_name ?? "-"}<div className="text-xs text-muted-foreground">{s.email}{s.employee_number ? ` - ${s.employee_number}` : ""}</div></TableCell>
                    <TableCell>{s.roles?.split(",").map((r) => labelOf(r.trim())).join(", ")}</TableCell>
                    <TableCell>{s.job_title ?? "-"}</TableCell>
                    <TableCell>{s.department ?? "-"}</TableCell>
                    <TableCell>{s.employment_type ? labelOf(s.employment_type) : "-"}</TableCell>
                    <TableCell className="space-x-1">
                      {s.employment_status ? <Badge variant={s.employment_status === "active" ? "default" : "secondary"}>{labelOf(s.employment_status)}</Badge> : <Badge variant="outline">No HR record</Badge>}
                      {s.on_leave_today && <Badge variant="outline">On leave today</Badge>}
                    </TableCell>
                    <TableCell>{fmtDate(s.start_date)}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setEditing(s)}>{s.employment_status ? "Edit" : "Add record"}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && !error && !rows.length && <p className="text-sm text-muted-foreground text-center py-8">No staff match these filters.</p>}
        </CardContent>
      </Card>
      <StaffEditDialog member={editing} onClose={() => setEditing(null)} />
    </DashboardLayout>
  );
};

export default withRoleAccess(HrEmployees, { requiredRoles: ["hr_officer", "admin", "organization_admin"] });
