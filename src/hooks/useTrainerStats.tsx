import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrainerStats {
  myClasses: number;
  totalStudents: number;
  attendanceToday: number;
  presentToday: number;
  attendanceRate: string;
}

// Using explicit function with any to avoid TypeScript recursion issues
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
    };
  }

  // Get classes
  const { data: classes } = await db.from("classes").select("id").eq("trainer_id", trainer.id).eq("active", true);
  const classCount = classes?.length || 0;
  const classIds = classes?.map((c: { id: string }) => c.id) || [];

  // Get total students
  let totalStudents = 0;
  if (classIds.length > 0) {
    const { data: enrollments } = await db.from("class_enrollments").select("id").in("class_id", classIds).eq("status", "active");
    totalStudents = enrollments?.length || 0;
  }

  return {
    myClasses: classCount,
    totalStudents,
    attendanceToday: 0,
    presentToday: 0,
    attendanceRate: "0",
  };
}

export const useTrainerStats = () => {
  return useQuery<TrainerStats | null>({
    queryKey: ["trainer-stats"],
    queryFn: fetchTrainerStats,
  });
};
