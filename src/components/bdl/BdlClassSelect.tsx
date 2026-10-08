import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BdlClass } from "@/hooks/useBdl";

export const BDL_ROLES = ["bdl_coordinator", "admin", "organization_admin", "head_of_training", "super_admin"] as const;

export function BdlClassSelect({ classes, value, onChange, loading }: { classes: BdlClass[]; value: string; onChange: (v: string) => void; loading?: boolean }) {
  return (
    <div className="space-y-1 min-w-[16rem]">
      <Label>Class</Label>
      <Select value={value} onValueChange={onChange} disabled={!classes.length}>
        <SelectTrigger><SelectValue placeholder={loading ? "Loading classes..." : "No blended classes"} /></SelectTrigger>
        <SelectContent>
          {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.class_name} ({c.class_code}, {c.academic_year})</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NoBdlClasses() {
  return (
    <p className="text-sm text-muted-foreground text-center py-8">
      No blended classes yet. A class becomes blended when its training mode is set to "Blended / Distance Learning" on the class.
    </p>
  );
}
