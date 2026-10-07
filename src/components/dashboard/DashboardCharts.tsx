import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface ChartData {
  name: string;
  value: number;
}

interface EnrollmentTrend {
  month: string;
  enrollments: number;
  completions: number;
}

interface DashboardChartsProps {
  enrollmentData?: ChartData[];
  feeCollectionData?: ChartData[];
  enrollmentTrends?: EnrollmentTrend[];
  moduleUsageData?: ChartData[];
}

export const EnrollmentChart = ({ data }: { data: ChartData[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Enrollment by Trade</CardTitle>
      <CardDescription>Distribution of trainees across trades</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }} 
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

export const FeeCollectionChart = ({ data }: { data: ChartData[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Fee Collection Status</CardTitle>
      <CardDescription>Breakdown of fee payment status</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
               label={false}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }} 
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 space-y-2 text-sm" aria-label="Fee collection breakdown">
        {data.map((item) => {
          const total = data.reduce((sum, row) => sum + row.value, 0);
          return <li key={item.name} className="flex flex-wrap justify-between gap-2"><span className="min-w-0 break-words text-muted-foreground">{item.name}</span><span className="font-medium">{total ? Math.round(item.value / total * 100) : 0}%</span></li>;
        })}
      </ul>
    </CardContent>
  </Card>
);

export const EnrollmentTrendChart = ({ data }: { data: EnrollmentTrend[] }) => (
  <Card className="md:col-span-2">
    <CardHeader>
      <CardTitle className="text-base">Enrollment Trends</CardTitle>
      <CardDescription>Monthly enrollment and completion rates</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }} 
            />
            <Legend />
            <Line type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="completions" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

export const ModuleUsageChart = ({ data }: { data: ChartData[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Module Usage</CardTitle>
      <CardDescription>Most accessed system modules</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 50, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }} 
            />
            <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);
