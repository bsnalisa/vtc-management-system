import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ExternalLink, Video } from "lucide-react";
import { VirtualSession, useClassSessions } from "@/hooks/useBdl";

const fmt = (d: string) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function SessionRow({ s, upcoming }: { s: VirtualSession; upcoming: boolean }) {
  return (
    <div className="border rounded-md p-3 text-sm flex items-start justify-between gap-3 flex-wrap">
      <div className="space-y-1 min-w-0">
        <div className="font-medium flex items-center gap-2 flex-wrap"><Video className="h-4 w-4" />{s.title}
          {s.status !== "scheduled" && <Badge variant={s.status === "cancelled" ? "destructive" : "outline"} className="capitalize">{s.status}</Badge>}
        </div>
        <div className="text-muted-foreground">{fmt(s.starts_at)}{s.ends_at ? ` to ${fmt(s.ends_at)}` : ""}{s.host_name ? ` - Host: ${s.host_name}` : ""}</div>
        {s.notes && <p className="whitespace-pre-wrap">{s.notes}</p>}
      </div>
      {upcoming && s.status === "scheduled" && (
        <Button size="sm" asChild>
          <a href={s.meeting_url} target="_blank" rel="noopener noreferrer">Join <ExternalLink className="h-3 w-3 ml-2" /></a>
        </Button>
      )}
    </div>
  );
}

export function SessionsTab({ classId, canManage }: { classId: string; canManage: boolean }) {
  const { data: sessions = [], isLoading, error } = useClassSessions(classId);
  const now = Date.now();
  const isUpcoming = (s: VirtualSession) => s.status === "scheduled" && new Date(s.ends_at ?? s.starts_at).getTime() >= now;
  const upcoming = sessions.filter(isUpcoming);
  const past = sessions.filter((s) => !isUpcoming(s)).reverse();

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
        <div>
          <CardTitle>Virtual sessions</CardTitle>
          <CardDescription>Live online sessions for this class.</CardDescription>
        </div>
        {canManage && <Button size="sm" variant="outline" asChild><Link to="/bdl/sessions">Manage sessions</Link></Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <LoadingSpinner size="sm" text="Loading sessions..." />}
        {error && <p className="text-sm text-destructive">Could not load sessions: {(error as Error).message}</p>}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Upcoming</h3>
          {upcoming.map((s) => <SessionRow key={s.id} s={s} upcoming />)}
          {!isLoading && !upcoming.length && <p className="text-sm text-muted-foreground">No upcoming sessions.</p>}
        </section>
        {past.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Past</h3>
            {past.map((s) => <SessionRow key={s.id} s={s} upcoming={false} />)}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
