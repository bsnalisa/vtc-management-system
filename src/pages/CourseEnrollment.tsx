import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrainees } from "@/hooks/useTrainees";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollTrainee, useCheckEnrollmentEligibility } from "@/hooks/useEnrollments";
import { useInitializeAssessmentResults } from "@/hooks/useAssessmentResults";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const CourseEnrollment = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel, dashboardPath } = useRoleNavigation();
  const { data: trainees } = useTrainees();
  const enrollTrainee = useEnrollTrainee();
  const checkEligibility = useCheckEnrollmentEligibility();
  const initializeResults = useInitializeAssessmentResults();
  
  const [selectedTrainee, setSelectedTrainee] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [eligibilityError, setEligibilityError] = useState("");

  const { data: courses } = useQuery({
    queryKey: ["activeCourses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedTraineeData = trainees?.find((t) => t.id === selectedTrainee);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEligibilityError("");

    if (!selectedTraineeData) return;

    // Check eligibility
    const isEligible = await checkEligibility.mutateAsync({
      traineeId: selectedTrainee,
      trainingMode: selectedTraineeData.training_mode as "fulltime" | "bdl" | "shortcourse",
    });

    if (!isEligible) {
      setEligibilityError(
        "This trainee cannot be enrolled due to active enrollment restrictions. Valid combinations: Full-time only, BDL only, Short Course only, Full-time + Short Course, or BDL + Short Course."
      );
      return;
    }

    // Enroll trainee
    const enrollment = await enrollTrainee.mutateAsync({
      trainee_id: selectedTrainee,
      course_id: selectedCourse,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: "active",
      academic_year: selectedTraineeData.academic_year,
    });

    // Initialize assessment results
    await initializeResults.mutateAsync({
      traineeId: selectedTrainee,
      enrollmentId: enrollment.id,
      courseId: selectedCourse,
    });

    navigate("/trainees");
  };

  return (
    <DashboardLayout
      title="Course Enrollment"
      subtitle="Enroll a trainee in a course"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Enrollment Details</CardTitle>
                <CardDescription>Select trainee and course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {eligibilityError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{eligibilityError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="trainee">Trainee *</Label>
                  <Select value={selectedTrainee} onValueChange={setSelectedTrainee} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainee" />
                    </SelectTrigger>
                    <SelectContent>
                      {trainees?.map((trainee) => (
                        <SelectItem key={trainee.id} value={trainee.id}>
                          {trainee.trainee_id} - {trainee.first_name} {trainee.last_name} ({trainee.training_mode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="course">Course *</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name} - Level {course.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTraineeData && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Trainee Information:</p>
                    <p className="text-sm text-muted-foreground">
                      Mode: {selectedTraineeData.training_mode} | Academic Year: {selectedTraineeData.academic_year}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse sm:flex-row gap-4 justify-end mt-6">
              <Button type="button" variant="outline" onClick={() => navigate(dashboardPath)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={enrollTrainee.isPending || !selectedTrainee || !selectedCourse} className="w-full sm:w-auto">
                {enrollTrainee.isPending ? "Enrolling..." : "Enroll Trainee"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CourseEnrollment;
