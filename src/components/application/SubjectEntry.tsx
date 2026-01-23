import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { SchoolSubject, EXAM_LEVELS, SYMBOLS_BY_LEVEL, SYMBOLS } from "@/types/application";
import { useCalculatePoints } from "@/hooks/useEntryRequirements";

interface SubjectEntryProps {
  subjects: SchoolSubject[];
  onSubjectsChange: (subjects: SchoolSubject[]) => void;
}

const COMMON_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Physical Science",
  "Chemistry",
  "Biology",
  "Geography",
  "History",
  "Accounting",
  "Business Studies",
  "Economics",
  "Computer Studies",
  "Agriculture",
  "Home Economics",
  "Technical Drawing",
  "Woodwork",
  "Metalwork",
  "Fashion & Fabrics",
  "Food & Nutrition",
  "Art",
  "Music",
  "Physical Education",
  "Life Science",
  "Development Studies",
  "Oshindonga",
  "Afrikaans",
  "German",
  "French",
];

export const SubjectEntry = ({ subjects, onSubjectsChange }: SubjectEntryProps) => {
  const { calculatePoints } = useCalculatePoints();
  const totalPoints = calculatePoints(subjects);

  const addSubject = () => {
    onSubjectsChange([
      ...subjects,
      { subject_name: "", exam_level: "NSSCO", symbol: "" },
    ]);
  };

  const removeSubject = (index: number) => {
    const newSubjects = subjects.filter((_, i) => i !== index);
    onSubjectsChange(newSubjects);
  };

  const updateSubject = (index: number, field: keyof SchoolSubject, value: string) => {
    const newSubjects = [...subjects];
    newSubjects[index] = { ...newSubjects[index], [field]: value };
    // Clear symbol when exam level changes (since symbols differ per level)
    if (field === 'exam_level') {
      newSubjects[index].symbol = '';
    }
    onSubjectsChange(newSubjects);
  };

  const getSymbolsForLevel = (examLevel: string): string[] => {
    return SYMBOLS_BY_LEVEL[examLevel] || SYMBOLS;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Subject Results</CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
              Total Points: {totalPoints}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSubject}>
              <Plus className="h-4 w-4 mr-1" />
              Add Subject
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {subjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No subjects added yet. Click "Add Subject" to add your results.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-4">Subject</div>
              <div className="col-span-4">Exam Level</div>
              <div className="col-span-3">Symbol</div>
              <div className="col-span-1"></div>
            </div>
            {subjects.map((subject, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Select
                    value={subject.subject_name}
                    onValueChange={(value) => updateSubject(index, "subject_name", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_SUBJECTS.map((subj) => (
                        <SelectItem key={subj} value={subj}>
                          {subj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Select
                    value={subject.exam_level}
                    onValueChange={(value) => updateSubject(index, "exam_level", value as SchoolSubject["exam_level"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Select
                    value={subject.symbol}
                    onValueChange={(value) => updateSubject(index, "symbol", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Symbol" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSymbolsForLevel(subject.exam_level).map((sym) => (
                        <SelectItem key={sym} value={sym}>
                          {sym}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubject(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
