import { AvailabilityMatrix } from './availabilityMatrix';
import {
  Day,
  LessonInstance,
  RoomInfo,
  TrainerInfo,
  SlotAssignment,
  SoftConstraintWeights,
  DEFAULT_WEIGHTS,
  CandidateSlot,
} from './types';

/**
 * Hard and soft constraint evaluation for candidate slots.
 */

export function checkHardConstraints(
  lesson: LessonInstance,
  day: Day,
  period: number,
  room: RoomInfo,
  trainers: Map<string, TrainerInfo>,
  matrix: AvailabilityMatrix,
  maxPeriods: number
): boolean {
  // 1. Trainer not double-booked
  if (!matrix.isTrainerAvailable(lesson.trainerId, day, period)) return false;

  // 2. Room not double-booked
  if (!matrix.isRoomAvailable(room.id, day, period)) return false;

  // 3. Class not double-booked
  if (!matrix.isClassAvailable(lesson.classId, day, period)) return false;

  // 4. Room capacity >= class size
  if ((room.capacity ?? 0) < lesson.classSize) return false;

  // 5. Room type must match
  if (room.roomType !== lesson.requiredRoomType) return false;

  // 6. Double period must have consecutive slot available
  if (lesson.isDoublePeriod) {
    const nextPeriod = period + 1;
    if (nextPeriod > maxPeriods) return false;
    if (!matrix.isTrainerAvailable(lesson.trainerId, day, nextPeriod)) return false;
    if (!matrix.isRoomAvailable(room.id, day, nextPeriod)) return false;
    if (!matrix.isClassAvailable(lesson.classId, day, nextPeriod)) return false;
  }

  // 7. Trainer weekly load check
  const trainer = trainers.get(lesson.trainerId);
  if (trainer) {
    const currentLoad = matrix.getTrainerWeeklyLoad(lesson.trainerId);
    const additionalPeriods = lesson.isDoublePeriod ? 2 : 1;
    if (currentLoad + additionalPeriods > trainer.maxWeeklyPeriods) return false;
  }

  return true;
}

export function scoreSoftConstraints(
  lesson: LessonInstance,
  day: Day,
  period: number,
  room: RoomInfo,
  currentAssignments: SlotAssignment[],
  matrix: AvailabilityMatrix,
  trainers: Map<string, TrainerInfo>,
  weights: SoftConstraintWeights = DEFAULT_WEIGHTS
): number {
  let penalty = 0;

  // +trainerGap if trainer has a gap before/after
  if (matrix.hasTrainerGap(lesson.trainerId, day, period)) {
    penalty += weights.trainerGap;
  }

  // +subjectRepeatInDay if subject appears > 2 times in one day for this class
  const subjectCountInDay = currentAssignments.filter(
    a => a.classId === lesson.classId && a.courseId === lesson.courseId && a.day === day
  ).length;
  if (subjectCountInDay >= 2) {
    penalty += weights.subjectRepeatInDay;
  }

  // +trainerDailyOverload if trainer exceeds preferred daily load
  const trainer = trainers.get(lesson.trainerId);
  if (trainer) {
    const dailyLoad = matrix.getTrainerDailyLoad(lesson.trainerId, day);
    if (dailyLoad >= trainer.preferredDailyPeriods) {
      penalty += weights.trainerDailyOverload;
    }
  }

  // +subjectSpread if this subject has slots clustered on too few days
  const subjectDays = new Set(
    currentAssignments
      .filter(a => a.classId === lesson.classId && a.courseId === lesson.courseId)
      .map(a => a.day)
  );
  subjectDays.add(day);
  const totalSubjectSlots = currentAssignments.filter(
    a => a.classId === lesson.classId && a.courseId === lesson.courseId
  ).length + 1;
  if (totalSubjectSlots > 2 && subjectDays.size < 2) {
    penalty += weights.subjectSpread;
  }

  return penalty;
}
