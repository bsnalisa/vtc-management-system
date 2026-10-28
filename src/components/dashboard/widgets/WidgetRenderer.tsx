import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type MyWidget, type WidgetData, useWidgetData } from "@/hooks/useRoleFactory";

const fmt = (v: string | number | null | undefined, unit?: string) => {
  if (v === null || v === undefined || v === "") return "-";
  const n = typeof v === "number" ? v.toLocaleString("en-ZA") : v;
  return unit === "N$" ? `N$ ${n}` : unit ? `${n}${unit}` : String(n);
};

function Body({ data }: { data: WidgetData }) {
  if (data.stats) {
    if (!data.stats.length) return <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>;
    return (
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((s) => <div key={s.label} className="rounded border p-3"><dt className="text-xs text-muted-foreground">{s.label}</dt><dd className="text-2xl font-semibold">{fmt(s.value, s.unit)}</dd></div>)}
      </dl>
    );
  }
  if (data.bars) {
    if (!data.bars.length) return <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>;
    const max = Math.max(...data.bars.map((b) => b.value), 1);
    return (
      <ul className="space-y-2">
        {data.bars.map((b) => (
          <li key={b.label} className="text-sm">
            <div className="flex justify-between gap-2"><span className="capitalize">{b.label}</span><span className="font-medium">{b.value.toLocaleString("en-ZA")}</span></div>
            <div className="mt-1 h-2 rounded bg-muted" role="presentation"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    );
  }
  if (data.columns) {
    if (!data.rows?.length) return <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>;
    return (
      <Table>
        <TableHeader><TableRow>{data.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{data.rows.map((r, i) => <TableRow key={i}>{r.map((cell, j) => <TableCell key={j}>{cell ?? "-"}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    );
  }
  return null;
}

// One reusable renderer: what to show is decided by the widget kind, and the figures come from the server,
// which checks the person's capability and centre before it answers.
export function WidgetRenderer({ org, widget }: { org: string; widget: MyWidget }) {
  const { data, isLoading, error } = useWidgetData(org, widget.code);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{widget.title}</CardTitle><CardDescription>{widget.description}</CardDescription></CardHeader>
      <CardContent>
        {isLoading && <LoadingSpinner text="Loading..." />}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {data && <Body data={data} />}
      </CardContent>
    </Card>
  );
}
