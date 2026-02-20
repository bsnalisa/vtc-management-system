import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TrainerData {
  user_id: string;
  organization_id: string;
  full_name: string;
  firstname: string;
  surname: string;
  email: string;
  phone: string;
  trainer_table_id?: string;
  trainer_id?: string;
  designation?: string;
  employment_type?: string;
  active?: boolean;
  assigned_trade_ids?: string[];
}

interface TrainerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainer: TrainerData | null;
}

export const TrainerEditDialog = ({ open, onOpenChange, trainer }: TrainerEditDialogProps) => {
  const queryClient = useQueryClient();
  const [firstname, setFirstname] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState("fulltime");
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);

  const { data: trades } = useQuery({
    queryKey: ["trades_for_assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("id, name, code")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (trainer) {
      setFirstname(trainer.firstname || "");
      setSurname(trainer.surname || "");
      setPhone(trainer.phone || "");
      setDesignation(trainer.designation || "");
      setEmploymentType(trainer.employment_type || "fulltime");
      setSelectedTradeIds(trainer.assigned_trade_ids || []);
    }
  }, [trainer]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!trainer) return;

      // 1. Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ firstname, surname, phone, full_name: `${firstname} ${surname}`.trim() })
        .eq("user_id", trainer.user_id);
      if (profileError) throw profileError;

      // 2. Upsert into trainers table
      const trainerData = {
        full_name: `${firstname} ${surname}`.trim(),
        phone,
        email: trainer.email,
        designation,
        employment_type: employmentType as any,
        organization_id: trainer.organization_id,
        active: true,
      };

      let trainerId = trainer.trainer_table_id;
      if (trainerId) {
        const { error } = await (supabase as any)
          .from("trainers")
          .update(trainerData)
          .eq("id", trainerId);
        if (error) throw error;
      } else {
        // Create new trainers record with generated ID
        const { data: newTrainer, error } = await (supabase as any)
          .from("trainers")
          .insert({
            ...trainerData,
            trainer_id: `TR-${Date.now().toString(36).toUpperCase()}`,
          })
          .select("id")
          .single();
        if (error) throw error;
        trainerId = newTrainer.id;
      }

      // 3. Sync trainer_trades
      if (trainerId) {
        // Delete existing
        await (supabase as any)
          .from("trainer_trades")
          .delete()
          .eq("trainer_id", trainerId);

        // Insert new
        if (selectedTradeIds.length > 0) {
          const rows = selectedTradeIds.map((trade_id) => ({
            trainer_id: trainerId,
            trade_id,
          }));
          const { error } = await (supabase as any)
            .from("trainer_trades")
            .insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers_from_user_roles"] });
      queryClient.invalidateQueries({ queryKey: ["active_trainers_from_roles"] });
      toast.success("Trainer updated successfully");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update trainer");
    },
  });

  const toggleTrade = (tradeId: string) => {
    setSelectedTradeIds((prev) =>
      prev.includes(tradeId) ? prev.filter((id) => id !== tradeId) : [...prev, tradeId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Trainer</DialogTitle>
          <DialogDescription>Update trainer profile, designation, and trade assignments.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstname} onChange={(e) => setFirstname(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Surname</Label>
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Instructor" />
          </div>
          <div className="space-y-2">
            <Label>Employment Type</Label>
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fulltime">Full Time</SelectItem>
                <SelectItem value="parttime">Part Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assigned Trades</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedTradeIds.map((id) => {
                const trade = trades?.find((t) => t.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {trade?.name || id}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTrade(id)} />
                  </Badge>
                );
              })}
              {selectedTradeIds.length === 0 && (
                <p className="text-sm text-muted-foreground">No trades assigned</p>
              )}
            </div>
            <Select onValueChange={(val) => { if (!selectedTradeIds.includes(val)) toggleTrade(val); }}>
              <SelectTrigger><SelectValue placeholder="Add a trade…" /></SelectTrigger>
              <SelectContent>
                {trades?.filter((t) => !selectedTradeIds.includes(t.id)).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
