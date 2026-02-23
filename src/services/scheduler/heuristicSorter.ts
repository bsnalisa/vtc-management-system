import { CourseInfo, LessonInstance, RoomInfo, TrainerInfo } from './types';

/**
 * Generates LessonInstances from classes+courses, then sorts by difficulty (descending).
 * Most constrained lessons are scheduled first.
 */

interface ClassCourseMapping {
  classId: string;
  classSize: number;
  tradeId: string;
  trainerId: string;
  courses: CourseInfo[];
}

export function generateLessonInstances(
  mappings: ClassCourseMapping[]
): LessonInstance[] {
  const lessons: LessonInstance[] = [];
  let counter = 0;

  for (const mapping of mappings) {
    for (const course of mapping.courses) {
      // Skip courses not matching the class trade/level
      const periodsNeeded = course.isDoublePeriod
        ? Math.ceil(course.periodsPerWeek / 2) // each instance covers 2 periods
        : course.periodsPerWeek;

      for (let i = 0; i < periodsNeeded; i++) {
        lessons.push({
          id: `lesson-${counter++}`,
          classId: mapping.classId,
          courseId: course.id,
          trainerId: mapping.trainerId,
          requiredRoomType: course.requiredRoomType,
          isDoublePeriod: course.isDoublePeriod,
          classSize: mapping.classSize,
          tradeId: mapping.tradeId,
          difficultyScore: 0, // computed later
        });
      }
    }
  }

  return lessons;
}

export function computeDifficultyScores(
  lessons: LessonInstance[],
  rooms: RoomInfo[],
  trainers: Map<string, TrainerInfo>
): LessonInstance[] {
  // Pre-compute room type rarity weights
  const roomTypeCounts: Record<string, number> = { classroom: 0, lab: 0, workshop: 0 };
  for (const room of rooms) {
    roomTypeCounts[room.roomType] = (roomTypeCounts[room.roomType] || 0) + 1;
  }
  const totalRooms = rooms.length || 1;

  return lessons.map(lesson => {
    let difficulty = 0;

    // Room type rarity: fewer rooms of this type = higher difficulty
    const roomCount = roomTypeCounts[lesson.requiredRoomType] || 0;
    difficulty += Math.round((1 - roomCount / totalRooms) * 30);

    // Trainer availability restriction: lower max = higher difficulty
    const trainer = trainers.get(lesson.trainerId);
    if (trainer) {
      difficulty += Math.max(0, 30 - trainer.maxWeeklyPeriods);
    }

    // Double period = harder to place
    if (lesson.isDoublePeriod) {
      difficulty += 20;
    }

    // Larger class = fewer suitable rooms
    const suitableRooms = rooms.filter(
      r => r.roomType === lesson.requiredRoomType && (r.capacity ?? 0) >= lesson.classSize
    ).length;
    difficulty += Math.round((1 - suitableRooms / totalRooms) * 20);

    return { ...lesson, difficultyScore: difficulty };
  });
}

export function sortByDifficulty(lessons: LessonInstance[]): LessonInstance[] {
  return [...lessons].sort((a, b) => b.difficultyScore - a.difficultyScore);
}
