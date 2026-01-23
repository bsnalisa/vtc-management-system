import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHostelBuildings, useHostelRooms, useHostelBeds, useCreateHostelAllocation } from "@/hooks/useHostel";
import { useTrainees } from "@/hooks/useTrainees";
import { useState } from "react";

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AllocationDialog({ open, onOpenChange }: AllocationDialogProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  
  const { data: buildings = [] } = useHostelBuildings();
  const { data: rooms = [] } = useHostelRooms(selectedBuilding || undefined);
  const { data: beds = [] } = useHostelBeds(selectedRoom || undefined);
  const { data: trainees = [] } = useTrainees();
  const createAllocationMutation = useCreateHostelAllocation();

  const form = useForm({
    defaultValues: {
      trainee_id: "",
      building_id: "",
      room_id: "",
      bed_id: "",
      check_in_date: new Date().toISOString().split("T")[0],
      expected_check_out_date: "",
      monthly_fee: 0,
      notes: "",
    },
  });

  const availableBeds = beds.filter((bed) => bed.status === "available");

  const onSubmit = async (data: any) => {
    // Get the selected trainee's gender
    const selectedTrainee = trainees.find(t => t.id === data.trainee_id);
    const selectedRoom = rooms.find(r => r.id === data.room_id);
    
    // Validate gender compatibility
    if (selectedTrainee && selectedRoom) {
      if (selectedRoom.gender_type !== "mixed" && 
          selectedTrainee.gender !== selectedRoom.gender_type) {
        alert(`Gender mismatch: This room is designated for ${selectedRoom.gender_type} trainees.`);
        return;
      }
    }

    await createAllocationMutation.mutateAsync({
      ...data,
      allocated_by: data.trainee_id, // Should be current user's ID
      status: "active",
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Allocate Bed to Trainee</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trainee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trainee</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trainees.map((trainee) => (
                        <SelectItem key={trainee.id} value={trainee.id}>
                          {trainee.trainee_id} - {trainee.first_name} {trainee.last_name} ({trainee.gender})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="building_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Building</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedBuilding(value);
                      form.setValue("room_id", "");
                      form.setValue("bed_id", "");
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {buildings
                        .filter((b) => b.active && b.current_occupancy < b.total_capacity)
                        .map((building) => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.building_name} ({building.gender_type}) - {building.current_occupancy}/
                            {building.total_capacity} occupied
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedRoom(value);
                      form.setValue("bed_id", "");
                      const room = rooms.find(r => r.id === value);
                      if (room) {
                        form.setValue("monthly_fee", room.monthly_fee);
                      }
                    }}
                    defaultValue={field.value}
                    disabled={!selectedBuilding}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms
                        .filter((r) => r.status === "available" && r.current_occupancy < r.capacity)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} ({room.gender_type}) - {room.current_occupancy}/{room.capacity} occupied
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Only rooms with available beds are shown</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bed_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bed</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedRoom}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bed" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableBeds.map((bed) => (
                        <SelectItem key={bed.id} value={bed.id}>
                          Bed {bed.bed_number}
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
                name="check_in_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-In Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expected_check_out_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Check-Out Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="monthly_fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Fee</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" onChange={e => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormDescription>Auto-filled from room settings</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              <Button type="submit" disabled={createAllocationMutation.isPending}>
                Allocate Bed
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
