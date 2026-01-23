import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEmployers } from "@/hooks/usePlacement";
import { Building } from "lucide-react";

const employerSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be less than 200 characters"),
  industry: z.string()
    .trim()
    .max(100, "Industry must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  contact_person: z.string()
    .trim()
    .max(150, "Contact person name must be less than 150 characters")
    .optional()
    .or(z.literal("")),
  contact_email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  contact_phone: z.string()
    .trim()
    .max(20, "Phone number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  address: z.string()
    .trim()
    .max(500, "Address must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  website: z.string()
    .trim()
    .url("Invalid website URL")
    .max(255, "Website URL must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  rating: z.number()
    .min(0, "Rating must be between 0 and 5")
    .max(5, "Rating must be between 0 and 5")
    .optional(),
  notes: z.string()
    .trim()
    .max(1000, "Notes must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
});

type EmployerFormValues = z.infer<typeof employerSchema>;

interface EmployerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employer?: any;
}

export function EmployerDialog({ open, onOpenChange, employer }: EmployerDialogProps) {
  const { createEmployer, updateEmployer } = useEmployers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmployerFormValues>({
    resolver: zodResolver(employerSchema),
    defaultValues: {
      name: employer?.name || "",
      industry: employer?.industry || "",
      contact_person: employer?.contact_person || "",
      contact_email: employer?.contact_email || "",
      contact_phone: employer?.contact_phone || "",
      address: employer?.address || "",
      website: employer?.website || "",
      rating: employer?.rating || undefined,
      notes: employer?.notes || "",
    },
  });

  const onSubmit = async (values: EmployerFormValues) => {
    setIsSubmitting(true);
    try {
      const sanitizedValues = {
        ...values,
        rating: values.rating || null,
      };

      if (employer) {
        await updateEmployer.mutateAsync({ id: employer.id, ...sanitizedValues });
      } else {
        await createEmployer.mutateAsync(sanitizedValues);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving employer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {employer ? "Edit Employer" : "Add New Employer"}
          </DialogTitle>
          <DialogDescription>
            {employer ? "Update employer information" : "Add a new partner organization"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC Manufacturing Ltd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturing, IT, Construction..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating (0-5)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value ? parseFloat(value) : undefined)}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="5">⭐⭐⭐⭐⭐ (5)</SelectItem>
                        <SelectItem value="4">⭐⭐⭐⭐ (4)</SelectItem>
                        <SelectItem value="3">⭐⭐⭐ (3)</SelectItem>
                        <SelectItem value="2">⭐⭐ (2)</SelectItem>
                        <SelectItem value="1">⭐ (1)</SelectItem>
                        <SelectItem value="0">No Rating</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+263 XX XXX XXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://example.com" {...field} />
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
                    <Textarea
                      placeholder="Physical address or location"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
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
                    <Textarea
                      placeholder="Additional information about the employer"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : employer ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
