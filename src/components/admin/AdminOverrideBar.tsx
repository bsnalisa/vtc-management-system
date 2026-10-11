import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminOverride } from "@/hooks/useAdminOverride";

const minutesLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));

// Header control for Organization Admins: shows whether finance and grades are read-only, and starts or ends an override.
export const AdminOverrideBar = () => {
  const { applies, override, start, end } = useAdminOverride();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [, tick] = useState(0);

  useEffect(() => {
    if (!override) return;
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [override]);

  if (!applies) return null;

  const submit = async () => {
    try {
      await start.mutateAsync({ reason: reason.trim(), minutes: Number(minutes) });
      toast.success("Override started. Changes to finance and grades are allowed and recorded in the audit log.");
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the override");
    }
  };

  return (
    <>
      {override ? (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400" title={override.reason}>
            <ShieldAlert className="h-3 w-3" />
            <span className="text-xs">Override active · {minutesLeft(override.expires_at)} min left</span>
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => end.mutate()} disabled={end.isPending}>
            End
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 sm:px-3" onClick={() => setOpen(true)} aria-label="Finance and grades are read-only. Start an admin override">
          <Lock className="h-4 w-4" />
          <span className="hidden lg:inline text-xs">Finance & grades read-only</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start an admin override</DialogTitle>
            <DialogDescription>
              As an Organization Admin you can read finance and grades but not change them. Start an override only when someone is stuck and
              the owner of that work cannot fix it. The reason and everything you change are recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason</Label>
              <Textarea id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: correcting a wrong fee for trainee NVTC202600001 while the debtor officer is on leave" rows={3} />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            </div>
            <div className="space-y-2">
              <Label>How long</Label>
              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={start.isPending || reason.trim().length < 10}>Start override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
