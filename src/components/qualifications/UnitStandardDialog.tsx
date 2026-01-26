import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  QualificationUnitStandard, 
  CreateUnitStandardData,
  useAddUnitStandardToQualification, 
  useUpdateUnitStandard 
} from "@/hooks/useQualifications";

interface UnitStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qualificationId: string;
  unitStandard?: QualificationUnitStandard | null;
}

export const UnitStandardDialog = ({ 
  open, 
  onOpenChange, 
  qualificationId,
  unitStandard 
}: UnitStandardDialogProps) => {
  const addMutation = useAddUnitStandardToQualification();
  const updateMutation = useUpdateUnitStandard();
  
  const [formData, setFormData] = useState({
    unit_standard_id: "",
    unit_standard_title: "",
    credit_value: "",
    level: 1,
    is_mandatory: true,
  });

  useEffect(() => {
    if (unitStandard) {
      setFormData({
        unit_standard_id: unitStandard.unit_standard_id,
        unit_standard_title: unitStandard.unit_standard_title,
        credit_value: unitStandard.credit_value?.toString() || "",
        level: unitStandard.level,
        is_mandatory: unitStandard.is_mandatory,
      });
    } else {
      setFormData({
        unit_standard_id: "",
        unit_standard_title: "",
        credit_value: "",
        level: 1,
        is_mandatory: true,
      });
    }
  }, [unitStandard, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: CreateUnitStandardData = {
      qualification_id: qualificationId,
      unit_standard_id: formData.unit_standard_id,
      unit_standard_title: formData.unit_standard_title,
      credit_value: formData.credit_value ? parseInt(formData.credit_value) : undefined,
      level: formData.level,
      is_mandatory: formData.is_mandatory,
    };
    
    if (unitStandard) {
      await updateMutation.mutateAsync({ 
        id: unitStandard.id, 
        ...data,
      });
    } else {
      await addMutation.mutateAsync(data);
    }
    
    onOpenChange(false);
  };

  const isLoading = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {unitStandard ? "Edit Unit Standard" : "Add Unit Standard"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitId">Unit Standard ID *</Label>
              <Input
                id="unitId"
                value={formData.unit_standard_id}
                onChange={(e) => setFormData({ ...formData, unit_standard_id: e.target.value.toUpperCase() })}
                placeholder="e.g., US-ICT-2034-01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select
                value={formData.level.toString()}
                onValueChange={(value) => setFormData({ ...formData, level: parseInt(value) })}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Unit Standard Title *</Label>
            <Input
              id="title"
              value={formData.unit_standard_title}
              onChange={(e) => setFormData({ ...formData, unit_standard_title: e.target.value })}
              placeholder="e.g., Install and configure computer hardware"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="credits">Credit Value</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                value={formData.credit_value}
                onChange={(e) => setFormData({ ...formData, credit_value: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="mandatory"
                  checked={formData.is_mandatory}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                />
                <Label htmlFor="mandatory" className="font-normal">
                  {formData.is_mandatory ? "Mandatory" : "Elective"}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : unitStandard ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
