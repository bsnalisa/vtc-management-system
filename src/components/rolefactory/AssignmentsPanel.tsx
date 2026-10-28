import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssignable, useCatalogue, useFactoryActions } from "@/hooks/useRoleFactory";

// Who holds which new role at one centre. The centre's Organisation Admin may assign roles without sensitive capabilities.
export function AssignmentsPanel({ org }: { org: string | null | undefined }) {
  const { data, isLoading, error } = useAssignable(org);
  const { data: catalogue } = useCatalogue();
  const act = useFactoryActions();
  const [user, setUser] = useState("");
  const [role, setRole] = useState("");
  if (!org) return <p className="text-sm text-muted-foreground">Choose a centre.</p>;
  if (isLoading) return <LoadingSpinner text="Loading..." className="py-6" />;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Could not load"}</p>;
  const label = (c: string) => catalogue?.find((k) => k.code === c)?.label ?? c;
  const picked = data.roles.find((r) => r.id === role);
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">A role made in the role factory grants only the capabilities its approved version lists. The person must already have a login at this centre; for a brand-new position, create the login in User Management with the Staff Member role (it has no access of its own), then assign the role here. Roles with sensitive capabilities are assigned by the Super Admin.</p>
      <div className="grid max-w-3xl items-end gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label>Person</Label><Select value={user} onValueChange={setUser}><SelectTrigger><SelectValue placeholder="Choose person" /></SelectTrigger><SelectContent>{data.staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue placeholder="Choose role" /></SelectTrigger><SelectContent>{data.roles.map((r) => <SelectItem key={r.id} value={r.id} disabled={!r.can_assign}>{r.role_name}{r.sensitive ? " (sensitive)" : ""}</SelectItem>)}</SelectContent></Select></div>
        <Button disabled={!user || !role || act.assign.isPending} onClick={async () => { await act.assign.mutateAsync({ org, user, role }); setUser(""); setRole(""); }}>Assign</Button>
      </div>
      {picked && <div className="flex max-w-3xl flex-wrap gap-1 text-sm"><span className="text-muted-foreground">Grants:</span>{picked.capabilities.map((c) => <Badge key={c} variant="secondary">{label(c)}</Badge>)}</div>}
      {!data.roles.length && <p className="text-sm text-muted-foreground">No role has been approved yet.</p>}
      <Table>
        <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Role</TableHead><TableHead>Since</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{data.assignments.map((a) => <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell>{a.role_name}</TableCell><TableCell>{new Date(a.assigned_at).toLocaleDateString()}</TableCell>
          <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={act.unassign.isPending} onClick={() => act.unassign.mutate(a.id)}>Remove</Button></TableCell></TableRow>)}</TableBody>
      </Table>
      {!data.assignments.length && <p className="text-sm text-muted-foreground">Nobody holds a new role at this centre yet.</p>}
    </div>
  );
}
