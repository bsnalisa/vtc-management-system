import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Search, Download, Eye } from "lucide-react";
import { useInvoices, useCreateInvoice, CreateInvoiceData } from "@/hooks/useInvoices";
import { useTrainees } from "@/hooks/useTrainees";
import { format, addDays } from "date-fns";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const InvoicesTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: trainees = [] } = useTrainees();
  const createInvoice = useCreateInvoice();

  const [formData, setFormData] = useState<CreateInvoiceData>({
    trainee_id: "",
    due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    items: [{ description: "", quantity: 1, unit_price: 0 }],
    notes: "",
  });

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.trainees?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.trainees?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, unit_price: 0 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createInvoice.mutateAsync(formData);
    setDialogOpen(false);
    setFormData({
      trainee_id: "",
      due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      items: [{ description: "", quantity: 1, unit_price: 0 }],
      notes: "",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500">Paid</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "overdue": return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled": return <Badge variant="outline">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) return <TableSkeleton columns={8} rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trainee *</Label>
                  <Select
                    value={formData.trainee_id}
                    onValueChange={(v) => setFormData({ ...formData, trainee_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainee" />
                    </SelectTrigger>
                    <SelectContent>
                      {trainees.slice(0, 100).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.trainee_id} - {t.first_name} {t.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date *</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Invoice Items *</Label>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-6"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        required
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                      />
                      <Input
                        className="col-span-3"
                        type="number"
                        step="0.01"
                        placeholder="Unit Price"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)}
                      />
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="col-span-1"
                          onClick={() => handleRemoveItem(index)}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>

              <div className="p-3 bg-muted rounded-lg text-right">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">N${calculateTotal().toLocaleString()}</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInvoice.isPending}>
                  {createInvoice.isPending ? "Creating..." : "Create Invoice"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Trainee</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>
                    {invoice.trainees ? `${invoice.trainees.first_name} ${invoice.trainees.last_name}` : "-"}
                  </TableCell>
                  <TableCell>{format(new Date(invoice.issue_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{format(new Date(invoice.due_date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right">N${invoice.total_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">N${invoice.amount_paid.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-orange-600">N${(invoice.balance || 0).toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
