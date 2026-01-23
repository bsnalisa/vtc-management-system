import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateHostelBuilding, useUpdateHostelBuilding } from "@/hooks/useHostel";

interface BuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  building?: any;
}

export function BuildingDialog({ open, onOpenChange, building }: BuildingDialogProps) {
  const createMutation = useCreateHostelBuilding();
  const updateMutation = useUpdateHostelBuilding();

  const form = useForm({
    defaultValues: {
      building_name: building?.building_name || "",
      building_code: building?.building_code || "",
      gender_type: building?.gender_type || "male",
      total_capacity: building?.total_capacity || 0,
      address: building?.address || "",
      facilities: building?.facilities || [],
      notes: building?.notes || "",
      active: building?.active ?? true,
    },
  });

  const onSubmit = async (data: any) => {
    if (building) {
      await updateMutation.mutateAsync({ id: building.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{building ? "Edit Building" : "Add Building"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="building_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., North Wing" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="building_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., BLD-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <FormField
                control={form.control}
                name="total_capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Capacity</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {building ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
