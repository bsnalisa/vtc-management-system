import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import {
  useAvailableHostelRooms, useMyHostelRequests, useRequestHostelRoom, useCancelHostelRequest,
  type HostelRequestStatus,
} from "@/hooks/useHostelRequests";

const STATUS_STYLE: Record<HostelRequestStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<HostelRequestStatus, string> = {
  requested: "Pending", approved: "Approved", rejected: "Declined", cancelled: "Cancelled",
};

interface Props { traineeId: string; hasAllocation: boolean }

/** Room requests for a trainee; the room list is hidden once they hold an allocation. */
export function RoomPicker({ traineeId, hasAllocation }: Props) {
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rooms = useAvailableHostelRooms(!hasAllocation);
  const requests = useMyHostelRequests(traineeId);
  const request = useRequestHostelRoom();
  const cancel = useCancelHostelRequest();
  const hasOpen = requests.data?.some((r) => r.status === "requested") ?? false;

  return (
    <div className="space-y-6">
      {!hasAllocation && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Choose a room</CardTitle>
            <CardDescription>
              Pick a room with a free bed and send a request. The Hostel Coordinator will approve or decline it.
              {hasOpen && " You already have a pending request; cancel it to request a different room."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rooms.isLoading && <LoadingIndicator className="h-6 w-6 text-muted-foreground" />}
            {rooms.error && <p className="text-sm text-destructive">{(rooms.error as Error).message}</p>}
            {rooms.data?.length === 0 && <p className="text-sm text-muted-foreground">No rooms are currently available to you.</p>}
            {rooms.data?.map((r) => (
              <div key={r.room_id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.building_name} - Room {r.room_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Floor {r.floor_number ?? "N/A"} • {r.room_type} • {r.free_beds} free bed{r.free_beds === 1 ? "" : "s"} of {r.capacity}
                      {r.monthly_fee != null && ` • N$ ${Number(r.monthly_fee).toLocaleString()}/month`}
                    </p>
                    {r.amenities && r.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.amenities.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant={selected === r.room_id ? "secondary" : "default"} disabled={hasOpen}
                    onClick={() => setSelected(selected === r.room_id ? null : r.room_id)}>
                    {selected === r.room_id ? "Close" : "Request this room"}
                  </Button>
                </div>
                {selected === r.room_id && (
                  <div className="space-y-2">
                    <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the coordinator" />
                    <Button size="sm" disabled={request.isPending}
                      onClick={() => request.mutate({ room: r.room_id, note }, { onSuccess: () => { setSelected(null); setNote(""); } })}>
                      Send request
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(requests.data?.length ?? 0) > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>My room requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {requests.data?.map((q) => (
              <div key={q.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted p-3">
                <div>
                  <p className="font-medium">
                    {q.hostel_rooms?.hostel_buildings?.building_name ?? "Building"} - Room {q.hostel_rooms?.room_number ?? "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">{new Date(q.created_at).toLocaleDateString("en-ZA")}</p>
                  {q.note && <p className="text-sm">Your note: {q.note}</p>}
                  {q.decision_notes && <p className="text-sm">Coordinator: {q.decision_notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_STYLE[q.status]}>{STATUS_LABEL[q.status]}</Badge>
                  {q.status === "requested" && (
                    <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(q.id)}>Cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {requests.error && <p className="text-sm text-destructive">{(requests.error as Error).message}</p>}
    </div>
  );
}
