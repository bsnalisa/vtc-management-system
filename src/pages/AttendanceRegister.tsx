import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrades } from "@/hooks/useTrades";
import { useTrainees } from "@/hooks/useTrainees";
import { useAttendanceRegister, RegisterKey } from "@/hooks/useAttendance";
import { TRAINING_MODES, TrainingMode, trainingModeLabel } from "@/lib/trainingModes";
import { CaptureTab } from "@/components/attendance/CaptureTab";
import { SummaryTab } from "@/components/attendance/SummaryTab";
import { BlankRegisterTab } from "@/components/attendance/BlankRegisterTab";

const AttendanceRegister = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [tradeId, setTradeId] = useState("");
  const [level, setLevel] = useState("");
  const [mode, setMode] = useState<TrainingMode | "">("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { data: trades } = useTrades();
  const { data: allTrainees } = useTrainees();

  const ready = !!tradeId && !!level && !!mode && !!year.trim();
  const key: RegisterKey | null = ready ? { tradeId, level: Number(level), mode: mode as TrainingMode, academicYear: year.trim() } : null;
  const { data: register, isLoading } = useAttendanceRegister(key);

  const trainees = useMemo(
    () => (key ? (allTrainees ?? []).filter((t) => t.trade_id === key.tradeId && t.level === key.level && t.training_mode === key.mode && t.academic_year === key.academicYear && t.status === "active")
      .sort((a, b) => a.last_name.localeCompare(b.last_name)) : []),
    [allTrainees, key?.tradeId, key?.level, key?.mode, key?.academicYear], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const title = key ? `${trades?.find((t) => t.id === key.tradeId)?.name ?? "Trade"} · Level ${key.level} · ${trainingModeLabel(key.mode)} · ${key.academicYear}` : "";

  return (
    <DashboardLayout title="Attendance" subtitle="Record, summarise and print class attendance" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Class</CardTitle><CardDescription>Choose the class whose attendance you want to record or review.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2"><Label>Trade / programme</Label>
              <Select value={tradeId} onValueChange={setTradeId}><SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                <SelectContent>{trades?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Level</Label>
              <Select value={level} onValueChange={setLevel}><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>Level {n}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Training mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as TrainingMode)}><SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>{TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{trainingModeLabel(m)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="year">Academic year</Label><Input id="year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026" /></div>
          </CardContent>
        </Card>

        {key && !isLoading && (
          <Card>
            <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{trainees.length} active trainee{trainees.length === 1 ? "" : "s"}</CardDescription></CardHeader>
            <CardContent>
              <Tabs defaultValue="capture">
                <TabsList><TabsTrigger value="capture">Take attendance</TabsTrigger><TabsTrigger value="summary">Weekly, monthly &amp; yearly summary</TabsTrigger><TabsTrigger value="blank">Print paper register</TabsTrigger></TabsList>
                <TabsContent value="capture"><CaptureTab register={register} registerKey={key} trainees={trainees} /></TabsContent>
                <TabsContent value="summary"><SummaryTab register={register} trainees={trainees} title={title} /></TabsContent>
                <TabsContent value="blank"><BlankRegisterTab trainees={trainees} title={title} /></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AttendanceRegister;
