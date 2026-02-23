import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrainerStats {
  myClasses: number;
  totalStudents: number;
  attendanceToday: number;
  presentToday: number;
  attendanceRate: string;
  classes: Array<{
    id: string;
    class_code: string;
    class_name: string;
    trade_name: string;
    level: number;
    training_mode: string;
    academic_year: string;
    capacity: number | null;
    student_count: number;
  }>;
  qualifications: Array<{
    id: string;
    qualification_code: string;
    qualification_title: string;
  }>;
}

async function fetchTrainerStats(): Promise<TrainerStats | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = supabase;

  // Get trainer record
  const { data: trainers } = await db.from("trainers").select("id").eq("user_id", user.id);
  const trainer = trainers?.[0];

  if (!trainer) {
    return {
      myClasses: 0,
      totalStudents: 0,
      attendanceToday: 0,
      presentToday: 0,
      attendanceRate: "0",
      classes: [],
      qualifications: [],
    };
  }

  // Get classes with trade info
  const { data: classes } = await db
    .from("classes")
    .select(`
      id, class_code, class_name, level, training_mode, academic_year, capacity,
      trades:trade_id (name)
    `)
    .eq("trainer_id", trainer.id)
    .eq("active", true);

  const classCount = classes?.length || 0;
  const classIds = classes?.map((c: any) => c.id) || [];

  // Get enrollments per class
  let totalStudents = 0;
  const classDetails: TrainerStats["classes"] = [];

  if (classIds.length > 0) {
    const { data: enrollments } = await db
      .from("class_enrollments")
      .select("id, class_id")
      .in("class_id", classIds)
      .eq("status", "active");

    totalStudents = enrollments?.length || 0;

    for (const cls of classes || []) {
      const count = enrollments?.filter((e: any) => e.class_id === cls.id).length || 0;
      classDetails.push({
        id: cls.id,
        class_code: cls.class_code,
        class_name: cls.class_name,
        trade_name: cls.trades?.name || "Unknown",
        level: cls.level,
        training_mode: cls.training_mode,
        academic_year: cls.academic_year,
        capacity: cls.capacity,
        student_count: count,
      });
    }
  }

  // Fetch assigned qualifications
  const { data: trainerQuals } = await db
    .from("trainer_qualifications")
    .select("qualification_id, qualifications:qualification_id (id, qualification_code, qualification_title)")
    .eq("trainer_id", trainer.id);

  const qualifications = (trainerQuals || []).map((tq: any) => ({
    id: tq.qualifications?.id || tq.qualification_id,
    qualification_code: tq.qualifications?.qualification_code || "",
    qualification_title: tq.qualifications?.qualification_title || "",
  }));

  return {
    myClasses: classCount,
    totalStudents,
    attendanceToday: 0,
    presentToday: 0,
    attendanceRate: "0",
    classes: classDetails,
    qualifications,
  };
}

export const useTrainerStats = () => {
  return useQuery<TrainerStats | null>({
    queryKey: ["trainer-stats"],
    queryFn: fetchTrainerStats,
  });
};
