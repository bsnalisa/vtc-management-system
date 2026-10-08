import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { OrgAdminStats } from "@/hooks/useOrgAdminStats";

export function SetupChecklist({ setup }: { setup: OrgAdminStats["setup"] }) {
  const navigate = useNavigate();
  const items = [
    { label: "Organization logo set", done: setup.logo, url: "/organization-settings", optional: false },
    { label: "At least one trade", done: setup.trades > 0, url: "/trade-management", optional: false },
    { label: "At least one qualification", done: setup.qualifications > 0, url: "/qualifications", optional: false },
    { label: "At least one trainer", done: setup.trainers > 0, url: "/trainers", optional: false },
    { label: "Application window set", done: setup.windows > 0, url: "/registration-windows", optional: false },
    { label: "Leave types configured", done: setup.leaveTypes > 0, url: "/hr/leave", optional: true },
    { label: "Library settings saved", done: setup.librarySettings, url: "/library?tab=reports", optional: true },
  ];
  const required = items.filter((i) => !i.optional);
  const doneCount = required.filter((i) => i.done).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Centre setup</CardTitle>
        <CardDescription>{doneCount} of {required.length} required steps complete</CardDescription>
        <Progress value={(doneCount / required.length) * 100} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <div key={i.label} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
            <div className="flex items-center gap-2">
              {i.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm">{i.label}</span>
              {i.optional && <Badge variant="outline">Optional</Badge>}
            </div>
            {!i.done && <Button size="sm" variant="outline" onClick={() => navigate(i.url)}>Fix</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
