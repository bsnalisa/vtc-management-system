import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TrainerDeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainer: { user_id: string; full_name: string; trainer_table_id?: string } | null;
}

export const TrainerDeactivateDialog = ({ open, onOpenChange, trainer }: TrainerDeactivateDialogProps) => {
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!trainer) return;

      // Soft-delete: remove the trainer role from user_roles
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", trainer.user_id)
        .eq("role", "trainer" as any);
      if (error) throw error;

      // Also mark as inactive in trainers table if record exists
      if (trainer.trainer_table_id) {
        await (supabase as any)
          .from("trainers")
          .update({ active: false })
          .eq("id", trainer.trainer_table_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers_from_user_roles"] });
      queryClient.invalidateQueries({ queryKey: ["active_trainers_from_roles"] });
      toast.success(`${trainer?.full_name} has been deactivated as a trainer`);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to deactivate trainer");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Deactivate Trainer
          </DialogTitle>
          <DialogDescription>
            This will remove the trainer role from <strong>{trainer?.full_name}</strong>. They will no longer appear in trainer lists or be assignable to classes/trades. This action can be reversed by re-assigning the trainer role in User Management.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
            {deactivateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Deactivate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
