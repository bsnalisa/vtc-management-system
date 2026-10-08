import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { VirtualSession, useBdlClasses, useSaveVirtualSession, useVirtualSessions } from "@/hooks/useBdl";
import { BDL_ROLES } from "@/components/bdl/BdlClassSelect";
import { SessionDialog } from "@/components/bdl/SessionDialog";

const fmt = (d: string) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const BdlSessions = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: classes = [] } = useBdlClasses();
  const { data: sessions = [], isLoading, error } = useVirtualSessions();
  const save = useSaveVirtualSession();
  const [editing, setEditing] = useState<VirtualSession | null>(null);
  const [open, setOpen] = useState(false);
  const [toCancel, setToCancel] = useState<VirtualSession | null>(null);

  const now = Date.now();
  const isUpcoming = (s: VirtualSession) => s.status === "scheduled" && new Date(s.ends_at ?? s.starts_at).getTime() >= now;
  const upcoming = sessions.filter(isUpcoming);
  const past = sessions.filter((s) => !isUpcoming(s)).reverse();

  const table = (rows: VirtualSession[], canAct: boolean) => (
    <>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Session</TableHead><TableHead>Class</TableHead><TableHead>When</TableHead><TableHead>Host</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.title}</TableCell>
              <TableCell>{s.classes ? `${s.classes.class_name} (${s.classes.class_code})` : "-"}</TableCell>
              <TableCell>{fmt(s.starts_at)}</TableCell>
              <TableCell>{s.host_name ?? "-"}</TableCell>
              <TableCell><Badge variant={s.status === "cancelled" ? "destructive" : s.status === "held" ? "default" : "secondary"} className="capitalize">{s.status}</Badge></TableCell>
              <TableCell className="text-right space-x-2">
                {s.status === "scheduled" && <Button variant="outline" size="sm" onClick={() => { setEditing(s); setOpen(true); }}>Edit</Button>}
                {canAct && s.status === "scheduled" && <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: s.id, status: "held" })}>Mark held</Button>}
                {s.status === "scheduled" && <Button variant="ghost" size="sm" onClick={() => setToCancel(s)}>Cancel</Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!isLoading && !rows.length && <p className="text-sm text-muted-foreground text-center py-8">No sessions here.</p>}
    </>
  );

  return (
    <DashboardLayout title="Virtual Sessions" subtitle="Schedule live online sessions for blended classes" navItems={navItems} groupLabel={groupLabel}>
      <Card className="border-0 shadow-md">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
          <div><CardTitle>Sessions</CardTitle><CardDescription>Trainees are notified when a session is created, moved or cancelled.</CardDescription></div>
          <Button size="sm" disabled={!classes.length} onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Schedule session</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <LoadingSpinner size="sm" text="Loading sessions..." />}
          {error && <p className="text-sm text-destructive">Could not load sessions: {(error as Error).message}</p>}
          {!classes.length && <p className="text-sm text-muted-foreground">There are no blended classes yet. Set a class's training mode to "Blended / Distance Learning" first.</p>}
          <Tabs defaultValue="upcoming">
            <TabsList><TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger><TabsTrigger value="past">Past ({past.length})</TabsTrigger></TabsList>
            <TabsContent value="upcoming">{table(upcoming, true)}</TabsContent>
            <TabsContent value="past">{table(past, false)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SessionDialog open={open} onClose={() => setOpen(false)} classes={classes} session={editing} defaultClass={classes[0]?.id ?? ""} />
      <ConfirmDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)} title="Cancel this session?"
        description={`"${toCancel?.title ?? ""}" will be cancelled and the class notified.`} confirmText="Cancel session" variant="destructive"
        onConfirm={() => { if (toCancel) save.mutate({ id: toCancel.id, status: "cancelled" }); setToCancel(null); }} />
    </DashboardLayout>
  );
};

export default withRoleAccess(BdlSessions, { requiredRoles: [...BDL_ROLES] });
