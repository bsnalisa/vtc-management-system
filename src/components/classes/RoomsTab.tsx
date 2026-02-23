import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DoorOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { useTrainingRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from "@/hooks/useTrainingBuildings";
import { useTrainingBuildings } from "@/hooks/useTrainingBuildings";
import { Badge } from "@/components/ui/badge";

interface RoomForm {
  building_id: string;
  name: string;
  code: string;
  room_type: string;
  capacity: number;
  description: string;
}

const EMPTY_FORM: RoomForm = { building_id: "", name: "", code: "", room_type: "classroom", capacity: 30, description: "" };

const ROOM_TYPE_LABELS: Record<string, string> = {
  classroom: "Classroom",
  lab: "Lab",
  workshop: "Workshop",
};

const RoomsTab = () => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<RoomForm>({ ...EMPTY_FORM });
  const [filterBuilding, setFilterBuilding] = useState<string>("all");

  const { data: rooms, isLoading } = useTrainingRooms(filterBuilding === "all" ? undefined : filterBuilding);
  const { data: buildings } = useTrainingBuildings();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const handleOpen = (room?: any) => {
    if (room) {
      setEditing(room);
      setForm({
        building_id: room.building_id,
        name: room.name,
        code: room.code,
        room_type: room.room_type,
        capacity: room.capacity || 30,
        description: room.description || "",
      });
    } else {
      setEditing(null);
      setForm({ ...EMPTY_FORM });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await updateRoom.mutateAsync({ id: editing.id, ...form });
    } else {
      await createRoom.mutateAsync(form);
    }
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const roomTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "lab": return "default" as const;
      case "workshop": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()}>
              <Plus className="h-4 w-4 mr-2" /> Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Room" : "Add Room"}</DialogTitle>
              <DialogDescription>{editing ? "Update room details" : "Define a new room inside a building"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Building</Label>
                  <Select value={form.building_id} onValueChange={(v) => setForm({ ...form, building_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                    <SelectContent>
                      {buildings?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Room 101" required />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g., R-101" required />
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select value={form.room_type} onValueChange={(v) => setForm({ ...form, room_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classroom">Classroom</SelectItem>
                      <SelectItem value="lab">Lab</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createRoom.isPending || updateRoom.isPending}>
                  {editing ? "Update Room" : "Add Room"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Filter by building:</Label>
          <Select value={filterBuilding} onValueChange={setFilterBuilding}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DoorOpen className="h-5 w-5" /> Rooms</CardTitle>
          <CardDescription>Classrooms, labs, and workshops inside buildings</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading rooms...</div>
          ) : !rooms?.length ? (
            <div className="text-center py-8 text-muted-foreground">No rooms found. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.code}</TableCell>
                    <TableCell>{room.name}</TableCell>
                    <TableCell>{room.training_buildings?.name || "—"}</TableCell>
                    <TableCell><Badge variant={roomTypeBadgeVariant(room.room_type)}>{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</Badge></TableCell>
                    <TableCell>{room.capacity}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpen(room)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Room</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete "{room.name}"?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteRoom.mutateAsync(room.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomsTab;
