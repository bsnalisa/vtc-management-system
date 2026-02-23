import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Zap, AlertTriangle, Lock, RefreshCw, Settings2 } from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { useTrainers } from "@/hooks/useTrainers";
import { useTrainingRooms } from "@/hooks/useTrainingBuildings";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import {
  useTimeStructure,
  useSeedDefaultPeriods,
  useTimetableEntries,
  useSaveTimetable,
  useToggleLock,
} from "@/hooks/useScheduler";
import { runScheduler, SchedulerInput, formatConflicts, DAYS, Day, SlotAssignment } from "@/services/scheduler";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import ConflictPanel from "@/components/timetable/ConflictPanel";

const TimetableManagement = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();

  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [term, setTerm] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("grid");

  const { data: classes } = useClasses();
  const { data: trainers } = useTrainers();
  const { data: rooms } = useTrainingRooms();
  const { data: timeStructure } = useTimeStructure(organizationId);
  const { data: entries, isLoading: entriesLoading } = useTimetableEntries(academicYear, term);
  const seedPeriods = useSeedDefaultPeriods();
  const saveTimetable = useSaveTimetable();
  const toggleLock = useToggleLock();

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ["courses_for_scheduler"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch trainer_trades for trade assignments
  const { data: trainerTrades } = useQuery({
    queryKey: ["trainer_trades_scheduler"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainer_trades")
        .select("trainer_id, trade_id");
      if (error) throw error;
      return data;
    },
  });

  const maxPeriods = timeStructure
    ? Math.max(...timeStructure.filter(t => !t.is_break).map(t => t.period_number), 0)
    : 8;

  const handleSeedPeriods = () => {
    if (organizationId) seedPeriods.mutate(organizationId);
  };

  const handleGenerate = useCallback(async () => {
    if (!classes?.length || !courses?.length || !rooms?.length || !trainers?.length) {
      toast({ title: "Missing Data", description: "Ensure classes, courses, rooms, and trainers exist.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      // Build trainer trade map
      const trainerTradeMap = new Map<string, string[]>();
      trainerTrades?.forEach(tt => {
        const existing = trainerTradeMap.get(tt.trainer_id) || [];
        existing.push(tt.trade_id);
        trainerTradeMap.set(tt.trainer_id, existing);
      });

      setProgress(20);

      // Get locked entries
      const lockedEntries: SlotAssignment[] = (entries || [])
        .filter((e: any) => e.is_locked)
        .map((e: any) => ({
          lessonInstanceId: `locked-${e.id}`,
          classId: e.class_id,
          courseId: e.course_id,
          trainerId: e.trainer_id,
          roomId: e.room_id,
          day: e.day as Day,
          periodNumber: e.period_number,
          softPenaltyScore: 0,
          isLocked: true,
          lockType: e.lock_type,
        }));

      const input: SchedulerInput = {
        classes: classes.map(c => ({
          id: c.id,
          className: c.class_name,
          classCode: c.class_code,
          tradeId: c.trade_id,
          capacity: c.capacity || 30,
          level: c.level,
          trainerId: c.trainer_id,
        })),
        courses: courses.map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
          tradeId: c.trade_id,
          level: c.level,
          periodsPerWeek: (c as any).periods_per_week || 2,
          requiredRoomType: ((c as any).required_room_type || 'classroom') as 'classroom' | 'lab' | 'workshop',
          isDoublePeriod: (c as any).is_double_period || false,
        })),
        trainers: trainers.map(t => ({
          id: t.id,
          fullName: t.full_name || 'Unknown',
          maxWeeklyPeriods: (t as any).max_weekly_periods || 25,
          preferredDailyPeriods: (t as any).preferred_daily_periods || 6,
          tradeIds: trainerTradeMap.get(t.id) || [],
        })),
        rooms: rooms.map(r => ({
          id: r.id,
          name: r.name,
          code: r.code,
          buildingId: r.building_id,
          roomType: r.room_type as 'classroom' | 'lab' | 'workshop',
          capacity: r.capacity || 30,
        })),
        maxPeriods,
        lockedAssignments: lockedEntries,
        config: { optimizationPasses: 100, maxBacktrackDepth: 50 },
      };

      setProgress(40);

      // Run the scheduler (in-memory, synchronous)
      const result = runScheduler(input);

      setProgress(80);
      setLastResult(result);

      // Save to database
      const runId = crypto.randomUUID();
      const userId = (await supabase.auth.getUser()).data.user?.id || '';
      const now = new Date().toISOString();

      const dbEntries = result.assignments
        .filter(a => !a.isLocked)
        .map(a => ({
          organization_id: organizationId!,
          academic_year: academicYear,
          term,
          class_id: a.classId,
          course_id: a.courseId,
          trainer_id: a.trainerId,
          room_id: a.roomId,
          day: a.day,
          period_number: a.periodNumber,
          is_locked: false,
          generation_run_id: runId,
          soft_penalty_score: a.softPenaltyScore,
        }));

      await saveTimetable.mutateAsync({
        entries: dbEntries,
        runMeta: {
          id: runId,
          organization_id: organizationId!,
          academic_year: academicYear,
          term,
          status: result.conflicts.length > 0 ? 'completed' : 'completed',
          total_lessons: result.totalLessons,
          placed_lessons: result.placedLessons,
          failed_lessons: result.failedLessons,
          global_penalty_score: result.globalPenaltyScore,
          conflict_report: result.conflicts,
          created_by: userId,
          started_at: now,
          completed_at: new Date().toISOString(),
        },
      });

      setProgress(100);
      toast({
        title: "Timetable Generated!",
        description: `${result.placedLessons} lessons placed, ${result.failedLessons} conflicts.`,
      });
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress(0), 2000);
    }
  }, [classes, courses, rooms, trainers, trainerTrades, entries, maxPeriods, organizationId, academicYear, term]);

  const handleToggleLock = (id: string, currentlyLocked: boolean) => {
    toggleLock.mutate({ id, isLocked: !currentlyLocked, lockType: 'full' });
  };

  // Build name maps for conflict reporting
  const courseNames = new Map(courses?.map(c => [c.id, c.name]) || []);
  const classNames = new Map(classes?.map(c => [c.id, c.class_name]) || []);
  const trainerNames = new Map(trainers?.map(t => [t.id, t.full_name || 'Unknown']) || []);

  const formattedConflicts = lastResult
    ? formatConflicts(lastResult.conflicts, courseNames, classNames, trainerNames)
    : [];

  const hasTimePeriods = timeStructure && timeStructure.length > 0;

  return (
    <DashboardLayout
      title="Timetable Generator"
      subtitle="Constraint-based heuristic scheduling engine"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Generation Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label>Academic Year</Label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Term</Label>
                <Select value={term.toString()} onValueChange={v => setTerm(parseInt(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map(t => (
                      <SelectItem key={t} value={t.toString()}>Term {t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!hasTimePeriods && (
                <Button variant="outline" onClick={handleSeedPeriods} disabled={seedPeriods.isPending}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Setup Period Structure
                </Button>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !hasTimePeriods}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate Timetable"}
              </Button>

              {lastResult && (
                <div className="flex items-center gap-3 ml-auto">
                  <Badge variant="secondary">
                    {lastResult.placedLessons}/{lastResult.totalLessons} placed
                  </Badge>
                  {lastResult.failedLessons > 0 && (
                    <Badge variant="destructive">
                      {lastResult.failedLessons} conflicts
                    </Badge>
                  )}
                  <Badge variant="outline">
                    Penalty: {lastResult.globalPenaltyScore}
                  </Badge>
                </div>
              )}
            </div>

            {isGenerating && (
              <Progress value={progress} className="mt-4 h-2" />
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="grid" className="gap-2">
              <Calendar className="h-4 w-4" /> Timetable Grid
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Conflicts
              {formattedConflicts.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {formattedConflicts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-4">
            <TimetableGrid
              entries={entries || []}
              timeStructure={timeStructure || []}
              isLoading={entriesLoading}
              onToggleLock={handleToggleLock}
              courseNames={courseNames}
              classNames={classNames}
              trainerNames={trainerNames}
            />
          </TabsContent>

          <TabsContent value="conflicts" className="mt-4">
            <ConflictPanel conflicts={formattedConflicts} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TimetableManagement;
