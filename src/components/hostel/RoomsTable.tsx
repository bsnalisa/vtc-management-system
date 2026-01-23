import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Bed } from "lucide-react";
import { useHostelRooms } from "@/hooks/useHostel";
import { RoomDialog } from "./RoomDialog";

export function RoomsTable() {
  const { data: rooms = [], isLoading } = useHostelRooms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  const handleEdit = (room: any) => {
    setSelectedRoom(room);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedRoom(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading rooms...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room Number</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Occupancy</TableHead>
              <TableHead>Monthly Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  <Bed className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No rooms found. Add your first room to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.room_number}</TableCell>
                  <TableCell>{room.hostel_buildings?.building_name || "N/A"}</TableCell>
                  <TableCell>{room.floor_number}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {room.room_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {room.gender_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{room.capacity}</TableCell>
                  <TableCell>
                    {room.current_occupancy} / {room.capacity}
                  </TableCell>
                  <TableCell>R {room.monthly_fee}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        room.status === "available"
                          ? "default"
                          : room.status === "occupied"
                          ? "secondary"
                          : "destructive"
                      }
                      className="capitalize"
                    >
                      {room.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(room)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RoomDialog open={dialogOpen} onOpenChange={setDialogOpen} room={selectedRoom} />
    </div>
  );
}
