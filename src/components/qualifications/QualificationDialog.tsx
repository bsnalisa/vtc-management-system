import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Qualification, 
  CreateQualificationData, 
  QualificationType, 
  DurationUnit,
  useCreateQualification, 
  useUpdateQualification 
} from "@/hooks/useQualifications";
import { useTradesForOrg } from "@/hooks/useTradesManagement";

interface QualificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qualification?: Qualification | null;
}

export const QualificationDialog = ({ open, onOpenChange, qualification }: QualificationDialogProps) => {
  const createMutation = useCreateQualification();
  const updateMutation = useUpdateQualification();
  const { data: trades } = useTradesForOrg();
  
  const [formData, setFormData] = useState<CreateQualificationData>({
    qualification_title: "",
    qualification_code: "",
    qualification_type: "nvc",
    nqf_level: 1,
    duration_value: 12,
    duration_unit: "months",
    trade_id: undefined,
  });

  useEffect(() => {
    if (qualification) {
      setFormData({
        qualification_title: qualification.qualification_title,
        qualification_code: qualification.qualification_code,
        qualification_type: qualification.qualification_type,
        nqf_level: qualification.nqf_level,
        duration_value: qualification.duration_value,
        duration_unit: qualification.duration_unit,
        trade_id: qualification.trade_id || undefined,
      });
    } else {
      setFormData({
        qualification_title: "",
        qualification_code: "",
        qualification_type: "nvc",
        nqf_level: 1,
        duration_value: 12,
        duration_unit: "months",
        trade_id: undefined,
      });
    }
  }, [qualification, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.trade_id) {
      return; // Trade is required
    }

    if (qualification) {
      await updateMutation.mutateAsync({ 
        id: qualification.id, 
        currentStatus: qualification.status,
        ...formData 
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
    
    onOpenChange(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  // Allow editing for approved qualifications too (will resubmit for approval)
  const isEditable = !qualification || ["draft", "rejected", "approved"].includes(qualification.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {qualification ? "Edit Qualification" : "Create New Qualification"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Qualification Title *</Label>
            <Input
              id="title"
              value={formData.qualification_title}
              onChange={(e) => setFormData({ ...formData, qualification_title: e.target.value })}
              placeholder="e.g., National Vocational Certificate in Information Technology"
              required
              disabled={!isEditable}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Qualification Code *</Label>
              <Input
                id="code"
                value={formData.qualification_code}
                onChange={(e) => setFormData({ ...formData, qualification_code: e.target.value.toUpperCase() })}
                placeholder="e.g., Q2034"
                required
                disabled={!isEditable}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Qualification Type *</Label>
              <Select
                value={formData.qualification_type}
                onValueChange={(value: QualificationType) => setFormData({ ...formData, qualification_type: value })}
                disabled={!isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nvc">NVC (National Vocational Certificate)</SelectItem>
                  <SelectItem value="diploma">Diploma</SelectItem>
                </SelectContent>
            </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trade">Trade *</Label>
            <Select
              value={formData.trade_id || ""}
              onValueChange={(value) => setFormData({ ...formData, trade_id: value || undefined })}
              disabled={!isEditable}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a trade" />
              </SelectTrigger>
              <SelectContent>
                {trades?.map((trade) => (
                  <SelectItem key={trade.id} value={trade.id}>
                    {trade.code} - {trade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A trade is required. Trainees can only register for qualifications linked to their applied trade.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nqf">NQF Level *</Label>
            <Select
              value={formData.nqf_level.toString()}
              onValueChange={(value) => setFormData({ ...formData, nqf_level: parseInt(value) })}
              disabled={!isEditable}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration *</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration_value}
                onChange={(e) => setFormData({ ...formData, duration_value: parseInt(e.target.value) || 1 })}
                required
                disabled={!isEditable}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Duration Unit *</Label>
              <Select
                value={formData.duration_unit}
                onValueChange={(value: DurationUnit) => setFormData({ ...formData, duration_unit: value })}
                disabled={!isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="months">Months</SelectItem>
                  <SelectItem value="years">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isEditable}>
              {isLoading ? "Saving..." : qualification ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
