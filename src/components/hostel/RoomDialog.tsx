import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHostelBuildings, useCreateHostelRoom, useUpdateHostelRoom, useCreateHostelBeds } from "@/hooks/useHostel";

interface RoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: any;
}

export function RoomDialog({ open, onOpenChange, room }: RoomDialogProps) {
  const { data: buildings = [] } = useHostelBuildings();
  const createRoomMutation = useCreateHostelRoom();
  const updateRoomMutation = useUpdateHostelRoom();
  const createBedsMutation = useCreateHostelBeds();

  const form = useForm({
    defaultValues: {
      building_id: room?.building_id || "",
      room_number: room?.room_number || "",
      floor_number: room?.floor_number || 1,
      room_type: room?.room_type || "dormitory",
      gender_type: room?.gender_type || "male",
      capacity: room?.capacity || 4,
      monthly_fee: room?.monthly_fee || 0,
      notes: room?.notes || "",
    },
  });

  const onSubmit = async (data: any) => {
    if (room) {
      await updateRoomMutation.mutateAsync({ id: room.id, ...data });
    } else {
      // Create room and automatically create beds
      const newRoom = await createRoomMutation.mutateAsync(data);
      
      // Create beds for the room
      const beds = Array.from({ length: data.capacity }, (_, i) => ({
        room_id: newRoom.id,
        building_id: data.building_id,
        bed_number: `${data.room_number}-${i + 1}`,
        bed_type: data.room_type === "single" ? "single" : "bunk",
        status: "available" as const,
      }));
      
      await createBedsMutation.mutateAsync(beds);
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="building_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Building</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {buildings.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.building_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="room_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 101" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="floor_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="room_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="double">Double</SelectItem>
                        <SelectItem value="dormitory">Dormitory</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity (Beds)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthly_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRoomMutation.isPending || updateRoomMutation.isPending}>
                {room ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
