import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar, Search } from "lucide-react";
import { usePaymentPlans, useCreatePaymentPlan, CreatePaymentPlanData } from "@/hooks/usePaymentPlans";
import { useTrainees } from "@/hooks/useTrainees";
import { useFeeRecords } from "@/hooks/useFeeRecords";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const PaymentPlansTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: plans = [], isLoading } = usePaymentPlans();
  const { data: trainees = [] } = useTrainees();
  const { data: feeRecords = [] } = useFeeRecords();
  const createPlan = useCreatePaymentPlan();

  const [formData, setFormData] = useState<CreatePaymentPlanData>({
    trainee_id: "",
    fee_record_id: "",
    plan_name: "Payment Plan",
    total_amount: 0,
    installments: 3,
    start_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const filteredPlans = plans.filter(p => 
    p.trainees?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.trainees?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.trainees?.trainee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPlan.mutateAsync(formData);
    setDialogOpen(false);
    setFormData({
      trainee_id: "",
      fee_record_id: "",
      plan_name: "Payment Plan",
      total_amount: 0,
      installments: 3,
      start_date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "active": return <Badge>Active</Badge>;
      case "defaulted": return <Badge variant="destructive">Defaulted</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get fee records for selected trainee
  const traineeFeesRecords = feeRecords.filter(f => f.trainee_id === formData.trainee_id);

  if (isLoading) return <TableSkeleton columns={7} rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payment plans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Payment Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment Plan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Trainee *</Label>
                <Select
                  value={formData.trainee_id}
                  onValueChange={(v) => setFormData({ ...formData, trainee_id: v, fee_record_id: "" })}
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

              {formData.trainee_id && (
                <div className="space-y-2">
                  <Label>Fee Record *</Label>
                  <Select
                    value={formData.fee_record_id}
                    onValueChange={(v) => {
                      const fee = traineeFeesRecords.find(f => f.id === v);
                      setFormData({ 
                        ...formData, 
                        fee_record_id: v,
                        total_amount: fee ? Number(fee.balance) || 0 : 0 
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fee record" />
                    </SelectTrigger>
                    <SelectContent>
                      {traineeFeesRecords.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.academic_year} - Balance: N${Number(f.balance || 0).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input
                  value={formData.plan_name}
                  onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Amount (N$) *</Label>
                  <Input
                    type="number"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Installments *</Label>
                  <Input
                    type="number"
                    min={2}
                    max={12}
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) || 3 })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">Installment Amount:</p>
                <p className="text-lg">
                  N${(formData.total_amount / formData.installments).toFixed(2)} × {formData.installments} installments
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPlan.isPending}>
                  {createPlan.isPending ? "Creating..." : "Create Plan"}
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
              <TableHead>Plan Name</TableHead>
              <TableHead>Trainee</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Installment</TableHead>
              <TableHead>Installments</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No payment plans found
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.plan_name}</TableCell>
                  <TableCell>
                    {plan.trainees ? `${plan.trainees.first_name} ${plan.trainees.last_name}` : "-"}
                  </TableCell>
                  <TableCell>N${plan.total_amount.toLocaleString()}</TableCell>
                  <TableCell>N${plan.installment_amount.toLocaleString()}</TableCell>
                  <TableCell>{plan.installments}</TableCell>
                  <TableCell>{format(new Date(plan.start_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{getStatusBadge(plan.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
