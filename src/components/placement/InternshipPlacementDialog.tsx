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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInternshipPlacements } from "@/hooks/usePlacement";
import { useEmployers } from "@/hooks/usePlacement";
import { useTrainees } from "@/hooks/useTrainees";
import { FileText, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const internshipSchema = z.object({
  trainee_id: z.string().uuid("Please select a trainee"),
  employer_id: z.string()
    .uuid("Invalid employer selection")
    .optional()
    .or(z.literal("")),
  supervisor_name: z.string()
    .trim()
    .max(150, "Supervisor name must be less than 150 characters")
    .optional()
    .or(z.literal("")),
  supervisor_contact: z.string()
    .trim()
    .max(100, "Supervisor contact must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  start_date: z.date({
    required_error: "Start date is required",
  }),
  end_date: z.date().optional(),
  status: z.enum(["pending", "approved", "active", "completed", "cancelled"]),
  evaluation_score: z.number()
    .min(0, "Score must be between 0 and 100")
    .max(100, "Score must be between 0 and 100")
    .optional(),
  evaluation_remarks: z.string()
    .trim()
    .max(2000, "Evaluation remarks must be less than 2000 characters")
    .optional()
    .or(z.literal("")),
}).refine((data) => {
  if (data.end_date && data.start_date) {
    return data.end_date >= data.start_date;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["end_date"],
});

type InternshipFormValues = z.infer<typeof internshipSchema>;

interface InternshipPlacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: any;
}

export function InternshipPlacementDialog({
  open,
  onOpenChange,
  placement,
}: InternshipPlacementDialogProps) {
  const { createPlacement, updatePlacement } = useInternshipPlacements();
  const { employers } = useEmployers();
  const { data: trainees } = useTrainees();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InternshipFormValues>({
    resolver: zodResolver(internshipSchema),
    defaultValues: {
      trainee_id: placement?.trainee_id || "",
      employer_id: placement?.employer_id || "",
      supervisor_name: placement?.supervisor_name || "",
      supervisor_contact: placement?.supervisor_contact || "",
      start_date: placement?.start_date ? new Date(placement.start_date) : undefined,
      end_date: placement?.end_date ? new Date(placement.end_date) : undefined,
      status: placement?.status || "pending",
      evaluation_score: placement?.evaluation_score || undefined,
      evaluation_remarks: placement?.evaluation_remarks || "",
    },
  });

  const onSubmit = async (values: InternshipFormValues) => {
    setIsSubmitting(true);
    try {
      const sanitizedValues = {
        ...values,
        employer_id: values.employer_id || null,
        start_date: format(values.start_date, "yyyy-MM-dd"),
        end_date: values.end_date ? format(values.end_date, "yyyy-MM-dd") : null,
        evaluation_score: values.evaluation_score || null,
      };

      if (placement) {
        await updatePlacement.mutateAsync({ id: placement.id, ...sanitizedValues });
      } else {
        await createPlacement.mutateAsync(sanitizedValues);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving internship placement:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {placement ? "Edit Internship Placement" : "Create Internship Placement"}
          </DialogTitle>
          <DialogDescription>
            {placement
              ? "Update internship/attachment details"
              : "Assign a trainee to an internship or job attachment"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trainee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trainee *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trainees?.map((trainee) => (
                        <SelectItem key={trainee.id} value={trainee.id}>
                          {trainee.trainee_id} - {trainee.first_name} {trainee.last_name}
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
              name="employer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employer/Organization</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employers?.map((employer) => (
                        <SelectItem key={employer.id} value={employer.id}>
                          {employer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supervisor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supervisor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supervisor_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supervisor Contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone or email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending Approval</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="evaluation_score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evaluation Score (0-100)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Enter score after evaluation"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? undefined : parseFloat(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="evaluation_remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evaluation Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Supervisor's feedback, performance notes, skills demonstrated, areas for improvement..."
                      className="resize-none"
                      rows={5}
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
                {isSubmitting ? "Saving..." : placement ? "Update" : "Create Placement"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
