import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCreateSupplier, useUpdateSupplier, Supplier } from "@/hooks/useProcurement";

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contact_person: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  tax_number: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  active: z.boolean(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}

const SupplierDialog = ({ open, onOpenChange, supplier }: SupplierDialogProps) => {
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contact_person: "",
      contact_email: "",
      contact_phone: "",
      tax_number: "",
      address: "",
      payment_terms: "",
      active: true,
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        name: supplier.name,
        contact_person: supplier.contact_person || "",
        contact_email: supplier.contact_email || "",
        contact_phone: supplier.contact_phone || "",
        tax_number: supplier.tax_number || "",
        address: supplier.address || "",
        payment_terms: supplier.payment_terms || "",
        active: supplier.active,
      });
    } else {
      form.reset({
        name: "",
        contact_person: "",
        contact_email: "",
        contact_phone: "",
        tax_number: "",
        address: "",
        payment_terms: "",
        active: true,
      });
    }
  }, [supplier, form]);

  const onSubmit = async (data: SupplierFormData) => {
    if (supplier) {
      await updateSupplier.mutateAsync({
        id: supplier.id,
        ...data,
      });
    } else {
      await createSupplier.mutateAsync({
        name: data.name,
        contact_person: data.contact_person || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        tax_number: data.tax_number || null,
        address: data.address || null,
        payment_terms: data.payment_terms || null,
        active: data.active,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
          <DialogDescription>
            {supplier ? "Update supplier information" : "Enter supplier details"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Net 30 days" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable or disable this supplier
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSupplier.isPending || updateSupplier.isPending}
              >
                {supplier ? "Update" : "Create"} Supplier
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierDialog;
