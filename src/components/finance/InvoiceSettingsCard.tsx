import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DEFAULT_FINANCE_SETTINGS, useFinanceSettings, useSaveFinanceSettings } from "@/hooks/useFinanceSettings";

export const InvoiceSettingsCard = () => {
  const { data, isLoading, error } = useFinanceSettings();
  const save = useSaveFinanceSettings();
  const [auto, setAuto] = useState(DEFAULT_FINANCE_SETTINGS.auto_draft_invoices);
  const [days, setDays] = useState(String(DEFAULT_FINANCE_SETTINGS.invoice_due_days));

  useEffect(() => {
    if (data) {
      setAuto(data.auto_draft_invoices);
      setDays(String(data.invoice_due_days));
    }
  }, [data]);

  const dueDays = Number(days);
  const valid = days.trim() !== "" && Number.isInteger(dueDays) && dueDays >= 0 && dueDays <= 365;
  const dirty = !!data && (auto !== data.auto_draft_invoices || dueDays !== data.invoice_due_days);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invoice settings</CardTitle>
        <CardDescription>Draft invoices are created for review and are not sent to trainees until issued.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">Could not load settings: {(error as Error).message}</p>}
        <div className="flex items-center gap-3">
          <Switch id="auto-draft" checked={auto} onCheckedChange={setAuto} disabled={isLoading} />
          <Label htmlFor="auto-draft">Create draft invoices automatically when a registration is completed</Label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="due-days">Invoice due after (days)</Label>
            <Input
              id="due-days"
              type="number"
              min={0}
              max={365}
              className="w-32"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button
            disabled={!valid || !dirty || save.isPending}
            onClick={() => save.mutate({ auto_draft_invoices: auto, invoice_due_days: dueDays })}
          >
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        {!valid && <p className="text-xs text-destructive">Enter a whole number of days from 0 to 365.</p>}
      </CardContent>
    </Card>
  );
};
