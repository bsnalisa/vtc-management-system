import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHostelBuildings, useHostelRooms, useCreateHostelMaintenanceIssue, useUpdateHostelMaintenanceIssue } from "@/hooks/useHostel";
import { useState } from "react";

interface MaintenanceIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: any;
}

export function MaintenanceIssueDialog({ open, onOpenChange, issue }: MaintenanceIssueDialogProps) {
  const [selectedBuilding, setSelectedBuilding] = useState(issue?.building_id || "");
  const { data: buildings = [] } = useHostelBuildings();
  const { data: rooms = [] } = useHostelRooms(selectedBuilding || undefined);
  const createMutation = useCreateHostelMaintenanceIssue();
  const updateMutation = useUpdateHostelMaintenanceIssue();

  const form = useForm({
    defaultValues: {
      building_id: issue?.building_id || "",
      room_id: issue?.room_id || "",
      issue_type: issue?.issue_type || "plumbing",
      issue_number: issue?.issue_number || "",
      description: issue?.description || "",
      priority: issue?.priority || "medium",
      status: issue?.status || "reported",
      reported_by: issue?.reported_by || "",
      estimated_cost: issue?.estimated_cost || 0,
      actual_cost: issue?.actual_cost || 0,
      resolution_notes: issue?.resolution_notes || "",
    },
  });

  const onSubmit = async (data: any) => {
    if (issue) {
      await updateMutation.mutateAsync({ id: issue.id, ...data });
    } else {
      await createMutation.mutateAsync({
        ...data,
        reported_by: data.reported_by, // Should be current user's ID
      });
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{issue ? "Update Maintenance Issue" : "Report Maintenance Issue"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!issue && (
              <FormField
                control={form.control}
                name="issue_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., MAINT-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
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
                      }}
                      defaultValue={field.value}
                    >
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
              <FormField
                control={form.control}
                name="room_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedBuilding}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number}
                          </SelectItem>
                        ))}
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
                name="issue_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="structural">Structural</SelectItem>
                        <SelectItem value="furniture">Furniture</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {issue && (
              <>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="reported">Reported</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estimated_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Cost</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="actual_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Cost</FormLabel>
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
                  name="resolution_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {issue ? "Update" : "Report Issue"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
