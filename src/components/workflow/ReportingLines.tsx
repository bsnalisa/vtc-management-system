import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useDeleteReportingLine, useDeleteUserSupervisor, useOrgUsers, useReportingLines, useRoleOptions, useSaveReportingLine,
  useSaveUserSupervisor, useUserSupervisors,
} from "@/hooks/useWorkflows";

/** Who reports to whom: the role-level lines every centre starts with, plus optional per-person supervisors. */
export function ReportingLinesTab() {
  const { data: lines } = useReportingLines();
  const { data: roles } = useRoleOptions();
  const { data: users } = useOrgUsers();
  const { data: overrides } = useUserSupervisors();
  const saveLine = useSaveReportingLine();
  const deleteLine = useDeleteReportingLine();
  const saveOverride = useSaveUserSupervisor();
  const deleteOverride = useDeleteUserSupervisor();
  const [role, setRole] = useState("");
  const [supervisorRole, setSupervisorRole] = useState("");
  const [person, setPerson] = useState("");
  const [boss, setBoss] = useState("");
  const roleName = (code: string) => roles?.find((r) => r.role_code === code)?.role_name ?? code;
  const userName = (id: string) => users?.find((u) => u.user_id === id)?.full_name ?? "A colleague";

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Approvals that go "to the submitter's direct supervisor" follow these lines: the request goes to everyone at the centre who holds the supervisor role.
          Anyone without a line (or without a supervisor in post) falls back to the Centre Manager.
        </p>
        <Table>
          <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Reports to</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {lines?.map((l) => (
              <TableRow key={l.role}>
                <TableCell className="font-medium">{roleName(l.role)}</TableCell>
                <TableCell>
                  <Select value={l.supervisor_role} onValueChange={(v) => saveLine.mutate({ role: l.role, supervisor_role: v })}>
                    <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>{roles?.filter((r) => r.role_code !== l.role).map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => deleteLine.mutate(l.role)}>Remove</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form className="grid gap-3 md:grid-cols-3 items-end border rounded-md p-4" onSubmit={async (e) => {
          e.preventDefault(); await saveLine.mutateAsync({ role, supervisor_role: supervisorRole }); setRole(""); setSupervisorRole("");
        }}>
          <div className="space-y-1"><Label>Role</Label>
            <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue placeholder="Choose role" /></SelectTrigger>
              <SelectContent>{roles?.map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Reports to</Label>
            <Select value={supervisorRole} onValueChange={setSupervisorRole}><SelectTrigger><SelectValue placeholder="Choose supervisor role" /></SelectTrigger>
              <SelectContent>{roles?.filter((r) => r.role_code !== role).map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" disabled={!role || !supervisorRole || saveLine.isPending}>Add or change line</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h4 className="font-medium">Named supervisors</h4>
        <p className="text-sm text-muted-foreground max-w-3xl">Use this when one person must report to a specific colleague instead of whoever holds the supervisor role.</p>
        <Table>
          <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Reports to</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {overrides?.map((o) => (
              <TableRow key={o.user_id}><TableCell>{userName(o.user_id)}</TableCell><TableCell>{userName(o.supervisor_user_id)}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => deleteOverride.mutate(o.user_id)}>Remove</Button></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
        {!overrides?.length && <p className="text-sm text-muted-foreground">No named supervisors.</p>}
        <form className="grid gap-3 md:grid-cols-3 items-end border rounded-md p-4" onSubmit={async (e) => {
          e.preventDefault(); await saveOverride.mutateAsync({ user_id: person, supervisor_user_id: boss }); setPerson(""); setBoss("");
        }}>
          <div className="space-y-1"><Label>Person</Label>
            <Select value={person} onValueChange={setPerson}><SelectTrigger><SelectValue placeholder="Choose person" /></SelectTrigger>
              <SelectContent>{users?.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Reports to</Label>
            <Select value={boss} onValueChange={setBoss}><SelectTrigger><SelectValue placeholder="Choose supervisor" /></SelectTrigger>
              <SelectContent>{users?.filter((u) => u.user_id !== person).map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" disabled={!person || !boss || saveOverride.isPending}>Save</Button>
        </form>
      </section>
    </div>
  );
}
