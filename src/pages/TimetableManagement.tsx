import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { headOfTrainingNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { useTimetable, useCreateTimetableSlot, useDeleteTimetableSlot, TimetableSlotData } from "@/hooks/useTimetable";
import { useClasses } from "@/hooks/useClasses";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TimetableManagement = () => {
  const [open, setOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [formData, setFormData] = useState<TimetableSlotData>({
    class_id: "",
    course_id: "",
    day_of_week: 1,
    start_time: "08:00",
    end_time: "10:00",
    room_number: "",
    academic_year: new Date().getFullYear().toString(),
  });

  const { data: classes } = useClasses();
  const { data: timetable, isLoading } = useTimetable(selectedClass || undefined);
  const createSlot = useCreateTimetableSlot();
  const deleteSlot = useDeleteTimetableSlot();

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSlot.mutateAsync(formData);
    setOpen(false);
    setFormData({
      class_id: "",
      course_id: "",
      day_of_week: 1,
      start_time: "08:00",
      end_time: "10:00",
      room_number: "",
      academic_year: new Date().getFullYear().toString(),
    });
  };

  const groupedByDay = timetable?.reduce((acc, slot) => {
    if (!acc[slot.day_of_week]) acc[slot.day_of_week] = [];
    acc[slot.day_of_week].push(slot);
    return acc;
  }, {} as Record<number, typeof timetable>);

  return (
    <DashboardLayout
      title="Timetable Management"
      subtitle="Manage class schedules and timetables"
      navItems={headOfTrainingNavItems}
      groupLabel="Training Management"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Slot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Timetable Slot</DialogTitle>
                <DialogDescription>Schedule a new class session</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={formData.class_id} onValueChange={(value) => setFormData({ ...formData, class_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes?.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={formData.course_id} onValueChange={(value) => setFormData({ ...formData, course_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select value={formData.day_of_week.toString()} onValueChange={(value) => setFormData({ ...formData, day_of_week: parseInt(value) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} placeholder="e.g., Room 101" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Slot</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Class Timetable
            </CardTitle>
            <CardDescription>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a class to view timetable" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading timetable...</div>
            ) : !selectedClass ? (
              <div className="text-center py-8 text-muted-foreground">Select a class to view its timetable</div>
            ) : (
              <div className="space-y-6">
                {DAYS.map((day, idx) => (
                  <div key={idx}>
                    <h3 className="font-semibold text-lg mb-3">{day}</h3>
                    {groupedByDay?.[idx]?.length ? (
                      <div className="space-y-2">
                        {groupedByDay[idx].map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{slot.courses?.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {slot.start_time} - {slot.end_time}
                                {slot.room_number && ` • ${slot.room_number}`}
                              </p>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => deleteSlot.mutate(slot.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground pl-4">No classes scheduled</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TimetableManagement;
