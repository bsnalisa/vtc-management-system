import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResourceCentreStats } from "@/hooks/useResourceCentreStats";

const COLOURS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" };

export function ResourceCentreCharts({ stats }: { stats: ResourceCentreStats }) {
  const hasLoans = stats.loansPerMonth.some((m) => m.loans > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Loans per month</CardTitle><CardDescription>Items issued over the last 6 months</CardDescription></CardHeader>
        <CardContent className="h-64">
          {hasLoans ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.loansPerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="loans" name="Loans" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">No loans have been issued in the last 6 months.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Items by type</CardTitle><CardDescription>Titles in the catalogue</CardDescription></CardHeader>
        <CardContent className="h-64">
          {stats.itemsByType.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.itemsByType} dataKey="value" nameKey="name" outerRadius={80} label>
                  {stats.itemsByType.map((_, i) => <Cell key={i} fill={COLOURS[i % COLOURS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">The catalogue has no items yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
