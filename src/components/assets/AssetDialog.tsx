import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAssetCategories, useCreateAsset } from "@/hooks/useAssets";

const formSchema = z.object({
  asset_code: z.string().min(1, "Asset code is required"),
  asset_name: z.string().min(1, "Asset name is required"),
  category_id: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  serial_number: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_cost: z.string(),
  depreciation_rate: z.string().optional(),
  useful_life_years: z.string().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor", "needs_repair"]),
  status: z.enum(["active", "under_repair", "disposed", "in_storage", "retired"]),
  location: z.string().optional(),
  assigned_department: z.string().optional(),
});

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssetDialog = ({ open, onOpenChange }: AssetDialogProps) => {
  const { data: categories } = useAssetCategories();
  const createAsset = useCreateAsset();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      asset_code: "",
      asset_name: "",
      category_id: "",
      condition: "good",
      status: "active",
      purchase_cost: "0",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createAsset.mutateAsync({
      asset_code: values.asset_code,
      asset_name: values.asset_name,
      category_id: values.category_id,
      description: values.description || null,
      serial_number: values.serial_number || null,
      manufacturer: values.manufacturer || null,
      model: values.model || null,
      purchase_date: values.purchase_date || null,
      purchase_cost: parseFloat(values.purchase_cost),
      current_value: null,
      depreciation_rate: values.depreciation_rate ? parseFloat(values.depreciation_rate) : null,
      useful_life_years: values.useful_life_years ? parseInt(values.useful_life_years) : null,
      warranty_expiry: null,
      condition: values.condition,
      status: values.status,
      location: values.location || null,
      assigned_department: values.assigned_department || null,
      assigned_user: null,
      notes: null,
      active: true,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="asset_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="AST001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="asset_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Laptop Dell XPS" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serial_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchase_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Cost (R)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depreciation_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Depreciation Rate (%)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="needs_repair">Needs Repair</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="under_repair">Under Repair</SelectItem>
                        <SelectItem value="in_storage">In Storage</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="disposed">Disposed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAsset.isPending}>
                {createAsset.isPending ? "Creating..." : "Create Asset"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
