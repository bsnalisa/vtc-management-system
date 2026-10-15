import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FinanceOverview, MonthlyFigure, money } from "@/hooks/useFinance";

const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" };

export function IncomeExpenditureChart({ data }: { data: MonthlyFigure[] }) {
  const any = data.some((m) => m.income > 0 || m.expenditure > 0);
  return (
    <Card>
      <CardHeader><CardTitle>Income and expenditure</CardTitle><CardDescription>Payments received and supplier invoices paid, by month</CardDescription></CardHeader>
      <CardContent className="h-64">
        {any ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenditure" name="Expenditure" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground">No payments received or supplier invoices paid in this period yet.</p>}
      </CardContent>
    </Card>
  );
}

export function BudgetUtilisation({ budgets }: { budgets: FinanceOverview["budgets"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Budget utilisation</CardTitle><CardDescription>This year, by department</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {!budgets.length && <p className="text-sm text-muted-foreground">No department budgets have been set for this year.</p>}
        {budgets.map((b) => {
          const pct = b.total > 0 ? Math.min(100, Math.round((Number(b.spent) / Number(b.total)) * 100)) : 0;
          return (
            <div key={b.department} className="space-y-1">
              <div className="flex justify-between text-sm"><span className="font-medium">{b.department}</span><span className="text-muted-foreground">{money(b.spent)} of {money(b.total)} ({pct}%)</span></div>
              <Progress value={pct} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Download rows as a CSV file (opens in Excel). */
export function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
