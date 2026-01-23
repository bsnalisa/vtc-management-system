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
import { useJobPostings } from "@/hooks/usePlacement";
import { useEmployers } from "@/hooks/usePlacement";
import { useTrades } from "@/hooks/useTrades";
import { Briefcase, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const jobPostingSchema = z.object({
  title: z.string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z.string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be less than 5000 characters"),
  requirements: z.string()
    .trim()
    .max(3000, "Requirements must be less than 3000 characters")
    .optional()
    .or(z.literal("")),
  employer_id: z.string()
    .uuid("Invalid employer selection")
    .optional()
    .or(z.literal("")),
  trade_id: z.string()
    .uuid("Invalid trade selection")
    .optional()
    .or(z.literal("")),
  location: z.string()
    .trim()
    .max(200, "Location must be less than 200 characters")
    .optional()
    .or(z.literal("")),
  salary_range: z.string()
    .trim()
    .max(100, "Salary range must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  closing_date: z.date().optional(),
  status: z.enum(["draft", "active", "closed", "filled"]),
});

type JobPostingFormValues = z.infer<typeof jobPostingSchema>;

interface JobPostingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobPosting?: any;
}

export function JobPostingDialog({ open, onOpenChange, jobPosting }: JobPostingDialogProps) {
  const { createJobPosting, updateJobPosting } = useJobPostings();
  const { employers } = useEmployers();
  const { data: trades } = useTrades();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<JobPostingFormValues>({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: {
      title: jobPosting?.title || "",
      description: jobPosting?.description || "",
      requirements: jobPosting?.requirements || "",
      employer_id: jobPosting?.employer_id || "",
      trade_id: jobPosting?.trade_id || "",
      location: jobPosting?.location || "",
      salary_range: jobPosting?.salary_range || "",
      closing_date: jobPosting?.closing_date ? new Date(jobPosting.closing_date) : undefined,
      status: jobPosting?.status || "active",
    },
  });

  const onSubmit = async (values: JobPostingFormValues) => {
    setIsSubmitting(true);
    try {
      const sanitizedValues = {
        ...values,
        employer_id: values.employer_id || null,
        trade_id: values.trade_id || null,
        closing_date: values.closing_date ? format(values.closing_date, "yyyy-MM-dd") : null,
      };

      if (jobPosting) {
        await updateJobPosting.mutateAsync({ id: jobPosting.id, ...sanitizedValues });
      } else {
        await createJobPosting.mutateAsync(sanitizedValues);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving job posting:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {jobPosting ? "Edit Job Posting" : "Create Job Posting"}
          </DialogTitle>
          <DialogDescription>
            {jobPosting ? "Update job opportunity details" : "Post a new job opportunity"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electrician, Welding Technician" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer</FormLabel>
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

              <FormField
                control={form.control}
                name="trade_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade/Specialization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trades?.map((trade) => (
                          <SelectItem key={trade.id} value={trade.id}>
                            {trade.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Harare, Bulawayo..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salary_range"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary Range</FormLabel>
                    <FormControl>
                      <Input placeholder="$500 - $800/month" {...field} />
                    </FormControl>
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
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="filled">Filled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="closing_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Closing Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed description of the position, responsibilities, and company information"
                      className="resize-none"
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements & Qualifications</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List the required skills, qualifications, certifications, and experience needed"
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
                {isSubmitting ? "Saving..." : jobPosting ? "Update" : "Publish"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
