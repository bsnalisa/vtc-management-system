import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useCreateReceivingReport,
  useUpdateReceivingReport,
  usePurchaseOrders,
  usePurchaseOrderItems,
  useReceivingReportItems,
  useCreateReceivingReportItem,
} from "@/hooks/useProcurement";

const reportSchema = z.object({
  receipt_number: z.string().min(1, "Receipt number is required"),
  purchase_order_id: z.string().min(1, "Purchase order is required"),
  received_date: z.string(),
  inspection_status: z.enum(["pending", "approved", "rejected"]),
  inspector_notes: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface ReceivingReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: any;
}

const ReceivingReportDialog = ({ open, onOpenChange, report }: ReceivingReportDialogProps) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [receivingData, setReceivingData] = useState<Record<string, { received: string; accepted: string; rejected: string; notes: string }>>({});

  const createReport = useCreateReceivingReport();
  const updateReport = useUpdateReceivingReport();
  const { data: orders = [] } = usePurchaseOrders();
  const { data: orderItems = [] } = usePurchaseOrderItems(selectedOrderId);
  const { data: reportItems = [] } = useReceivingReportItems(report?.id || null);
  const createReportItem = useCreateReceivingReportItem();

  const sentOrders = orders.filter(o => o.status === 'sent');

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      receipt_number: `RCV-${Date.now()}`,
      purchase_order_id: "",
      received_date: new Date().toISOString().split('T')[0],
      inspection_status: "pending",
      inspector_notes: "",
    },
  });

  useEffect(() => {
    if (report) {
      form.reset({
        receipt_number: report.receipt_number,
        purchase_order_id: report.purchase_order_id,
        received_date: report.received_date,
        inspection_status: report.inspection_status,
        inspector_notes: report.inspector_notes || "",
      });
      setSelectedOrderId(report.purchase_order_id);
    } else {
      form.reset({
        receipt_number: `RCV-${Date.now()}`,
        purchase_order_id: "",
        received_date: new Date().toISOString().split('T')[0],
        inspection_status: "pending",
        inspector_notes: "",
      });
      setSelectedOrderId(null);
    }
  }, [report, form]);

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    form.setValue("purchase_order_id", orderId);
  };

  const onSubmit = async (data: ReportFormData) => {
    if (report) {
      await updateReport.mutateAsync({
        id: report.id,
        ...data,
      });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const newReport = await createReport.mutateAsync({
        receipt_number: data.receipt_number,
        purchase_order_id: data.purchase_order_id,
        received_date: data.received_date,
        received_by: user.id,
        inspection_status: data.inspection_status,
        inspector_notes: data.inspector_notes || null,
      });

      // Create receiving report items
      for (const [itemId, values] of Object.entries(receivingData)) {
        if (values.received) {
          await createReportItem.mutateAsync({
            receiving_report_id: newReport.id,
            po_item_id: itemId,
            quantity_received: parseFloat(values.received),
            quantity_accepted: parseFloat(values.accepted || "0"),
            quantity_rejected: parseFloat(values.rejected || "0"),
            condition_notes: values.notes || null,
          });
        }
      }
    }
    onOpenChange(false);
  };

  const handleReceivingChange = (itemId: string, field: string, value: string) => {
    setReceivingData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      }
    }));
  };

  const canEdit = !report || report.inspection_status === 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {report ? "Receiving Report Details" : "New Receiving Report"}
          </DialogTitle>
          <DialogDescription>
            {canEdit ? "Record received items and inspection results" : "View receiving report"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="receipt_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Number *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!!report} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchase_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={handleOrderChange}
                      disabled={!!report}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purchase order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sentOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.po_number} - {order.suppliers?.name}
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
                name="received_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={!canEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inspection_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspection Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!canEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {orderItems.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Items to Receive</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Accepted</TableHead>
                      <TableHead className="text-right">Rejected</TableHead>
                      <TableHead>Condition Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => {
                      const existingItem = reportItems.find((ri: any) => ri.po_item_id === item.id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.item_description}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{item.quantity_ordered}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {report ? (
                              existingItem?.quantity_received || 0
                            ) : (
                              <Input
                                type="number"
                                className="w-20"
                                value={receivingData[item.id]?.received || ""}
                                onChange={(e) => handleReceivingChange(item.id, "received", e.target.value)}
                                disabled={!canEdit}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {report ? (
                              existingItem?.quantity_accepted || 0
                            ) : (
                              <Input
                                type="number"
                                className="w-20"
                                value={receivingData[item.id]?.accepted || ""}
                                onChange={(e) => handleReceivingChange(item.id, "accepted", e.target.value)}
                                disabled={!canEdit}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {report ? (
                              existingItem?.quantity_rejected || 0
                            ) : (
                              <Input
                                type="number"
                                className="w-20"
                                value={receivingData[item.id]?.rejected || ""}
                                onChange={(e) => handleReceivingChange(item.id, "rejected", e.target.value)}
                                disabled={!canEdit}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {report ? (
                              existingItem?.condition_notes || "-"
                            ) : (
                              <Input
                                className="w-40"
                                value={receivingData[item.id]?.notes || ""}
                                onChange={(e) => handleReceivingChange(item.id, "notes", e.target.value)}
                                disabled={!canEdit}
                                placeholder="Notes"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <FormField
              control={form.control}
              name="inspector_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inspector Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} disabled={!canEdit} />
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
              >
                {canEdit ? "Cancel" : "Close"}
              </Button>
              {canEdit && (
                <Button
                  type="submit"
                  disabled={createReport.isPending || updateReport.isPending}
                >
                  {report ? "Update" : "Create"} Report
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ReceivingReportDialog;
