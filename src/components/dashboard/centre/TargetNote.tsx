import { Badge } from "@/components/ui/badge";
import { TARGETS } from "@/hooks/useCentreManagerPanels";

// "On target" / "Off target (85%)" next to a figure; nothing when no target has been set
export function TargetNote({ indicator, value, targets }: { indicator: string; value: number | null | undefined; targets: Record<string, number> | undefined }) {
  const t = targets?.[indicator];
  const def = TARGETS[indicator];
  if (t == null || value == null || !def) return null;
  const ok = def.goodWhen === "min" ? value >= t : value <= t;
  return <Badge variant={ok ? "secondary" : "destructive"} className="whitespace-nowrap">{ok ? "On target" : `Off target (${def.goodWhen === "min" ? "min" : "max"} ${t}${def.unit})`}</Badge>;
}
