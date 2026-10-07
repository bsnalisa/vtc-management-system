import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  ProcessType, WorkflowDefinition, WorkflowStep, useOrgUsers, useRoleOptions, useSaveDefinition,
} from "@/hooks/useWorkflows";

type Who = { kind: "role" | "user"; value: string };
interface DraftStep {
  name: string; approver: Who; sla: string; escalate: Who | null; selfApproval: boolean;
}

const fromStep = (s: WorkflowStep): DraftStep => ({
  name: s.name,
  approver: s.approver_user ? { kind: "user", value: s.approver_user } : { kind: "role", value: s.approver_role ?? "" },
  sla: s.sla_hours ? String(s.sla_hours) : "",
  escalate: s.escalate_to_user ? { kind: "user", value: s.escalate_to_user } : s.escalate_to_role ? { kind: "role", value: s.escalate_to_role } : null,
  selfApproval: s.allow_self_approval,
});
const blank = (): DraftStep => ({ name: "", approver: { kind: "role", value: "" }, sla: "", escalate: null, selfApproval: false });

function WhoPicker({ value, onChange, allowNone }: { value: Who | null; onChange: (w: Who | null) => void; allowNone?: boolean }) {
  const { data: roles } = useRoleOptions();
  const { data: users } = useOrgUsers();
  return (
    <div className="flex gap-2">
      <Select value={value?.kind ?? "none"} onValueChange={(k) => onChange(k === "none" ? null : { kind: k as Who["kind"], value: "" })}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="none">Nobody</SelectItem>}
          <SelectItem value="role">A role</SelectItem>
          <SelectItem value="user">A person</SelectItem>
        </SelectContent>
      </Select>
      {value?.kind === "role" && (
        <Select value={value.value} onValueChange={(v) => onChange({ kind: "role", value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Choose role" /></SelectTrigger>
          <SelectContent>{roles?.map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {value?.kind === "user" && (
        <Select value={value.value} onValueChange={(v) => onChange({ kind: "user", value: v })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Choose person" /></SelectTrigger>
          <SelectContent>{users?.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  );
}

export function WorkflowEditor({ definition, processTypes, onClose }: { definition: WorkflowDefinition | null; processTypes: ProcessType[]; onClose: () => void }) {
  const save = useSaveDefinition();
  const [name, setName] = useState(definition?.name ?? "");
  const [processType, setProcessType] = useState(definition?.process_type ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(definition?.workflow_steps.length ? definition.workflow_steps.map(fromStep) : [blank()]);

  const patch = (i: number, p: Partial<DraftStep>) => setSteps((s) => s.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setSteps((s) => {
    const j = i + d;
    if (j < 0 || j >= s.length) return s;
    const c = [...s];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  const problems: string[] = [];
  if (!name.trim()) problems.push("Name the workflow");
  if (!processType) problems.push("Choose the process");
  if (!steps.length) problems.push("Add at least one step");
  steps.forEach((s, i) => {
    if (!s.name.trim()) problems.push(`Step ${i + 1} needs a name`);
    if (!s.approver.value) problems.push(`Step ${i + 1} needs an approver`);
    if (s.escalate && !s.escalate.value) problems.push(`Step ${i + 1}: choose who to escalate to, or pick "Nobody"`);
    if (s.escalate && !s.sla) problems.push(`Step ${i + 1}: escalation needs a response time (hours)`);
    if (s.sla && !(Number(s.sla) > 0)) problems.push(`Step ${i + 1}: response time must be more than zero`);
  });

  const submit = async () => {
    const out: WorkflowStep[] = steps.map((s, i) => ({
      step_no: i + 1, name: s.name.trim(),
      approver_role: s.approver.kind === "role" ? s.approver.value : null, approver_user: s.approver.kind === "user" ? s.approver.value : null,
      sla_hours: s.sla ? Number(s.sla) : null,
      escalate_to_role: s.escalate?.kind === "role" ? s.escalate.value : null, escalate_to_user: s.escalate?.kind === "user" ? s.escalate.value : null,
      allow_self_approval: s.selfApproval,
    }));
    await save.mutateAsync({ id: definition?.id, process_type: processType, name: name.trim(), steps: out });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{definition ? "Edit workflow" : "New workflow"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Process</Label>
              <Select value={processType} onValueChange={setProcessType} disabled={!!definition}>
                <SelectTrigger><SelectValue placeholder="Choose process" /></SelectTrigger>
                <SelectContent>{processTypes.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          {processType && <p className="text-xs text-muted-foreground">{processTypes.find((p) => p.code === processType)?.description}</p>}

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium w-14">Step {i + 1}</span>
                  <Input placeholder="Step name, e.g. Head of Training" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove step" onClick={() => setSteps((x) => x.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1"><Label>Who approves (any one holder of the role may decide)</Label>
                  <WhoPicker value={s.approver} onChange={(w) => patch(i, { approver: w ?? { kind: "role", value: "" } })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Respond within (hours, optional)</Label>
                    <Input type="number" min={1} value={s.sla} onChange={(e) => patch(i, { sla: e.target.value })} /></div>
                  <div className="space-y-1"><Label>If overdue, also ask</Label>
                    <WhoPicker allowNone value={s.escalate} onChange={(w) => patch(i, { escalate: w })} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={s.selfApproval} onCheckedChange={(v) => patch(i, { selfApproval: v })} />
                  <Label>The person who made the request may also approve this step</Label></div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setSteps((x) => [...x, blank()])}><Plus className="h-4 w-4 mr-1" />Add step</Button>
          </div>

          {problems.length > 0 && <ul className="text-xs text-destructive list-disc ml-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="flex gap-2">
            <Button disabled={problems.length > 0 || save.isPending} onClick={submit}>Save workflow</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
