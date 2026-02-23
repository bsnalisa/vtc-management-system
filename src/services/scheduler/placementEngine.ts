import { AvailabilityMatrix } from './availabilityMatrix';
import { checkHardConstraints, scoreSoftConstraints } from './constraintBuilder';
import {
  CandidateSlot,
  ConflictReport,
  Day,
  DAYS,
  LessonInstance,
  RoomInfo,
  SchedulerConfig,
  SlotAssignment,
  TrainerInfo,
} from './types';

/**
 * Core placement engine with controlled backtracking.
 * For each lesson (sorted by difficulty):
 *   1. Generate all valid candidate slots
 *   2. Filter using hard constraints
 *   3. Score with soft constraints
 *   4. Select lowest penalty slot
 *   5. Backtrack if no valid slot
 */

export function runPlacement(
  lessons: LessonInstance[],
  rooms: RoomInfo[],
  trainers: Map<string, TrainerInfo>,
  matrix: AvailabilityMatrix,
  maxPeriods: number,
  config: SchedulerConfig,
  lockedAssignments: SlotAssignment[] = []
): { assignments: SlotAssignment[]; conflicts: ConflictReport[] } {
  const assignments: SlotAssignment[] = [...lockedAssignments];
  const conflicts: ConflictReport[] = [];
  const assignmentStack: { lesson: LessonInstance; candidates: CandidateSlot[]; choiceIndex: number }[] = [];

  let i = 0;
  let backtrackCount = 0;

  while (i < lessons.length) {
    const lesson = lessons[i];

    // Generate and score all candidate slots
    const candidates = generateCandidates(lesson, rooms, trainers, matrix, assignments, maxPeriods, config);

    if (candidates.length > 0) {
      // Pick the best (lowest penalty) slot
      const best = candidates[0];
      const assignment = createAssignment(lesson, best);
      assignments.push(assignment);

      // Mark matrices
      matrix.markOccupied(lesson.trainerId, best.roomId, lesson.classId, best.day, best.periodNumber);
      if (lesson.isDoublePeriod) {
        matrix.markOccupied(lesson.trainerId, best.roomId, lesson.classId, best.day, best.periodNumber + 1);
      }

      // Save to stack for potential backtracking
      assignmentStack.push({ lesson, candidates, choiceIndex: 0 });
      i++;
    } else {
      // No valid slot - attempt backtracking
      if (backtrackCount < config.maxBacktrackDepth && assignmentStack.length > 0) {
        backtrackCount++;
        const prev = assignmentStack.pop()!;

        // Undo previous assignment
        const prevAssignment = assignments.pop()!;
        matrix.markAvailable(prev.lesson.trainerId, prevAssignment.roomId, prev.lesson.classId, prevAssignment.day, prevAssignment.periodNumber);
        if (prev.lesson.isDoublePeriod) {
          matrix.markAvailable(prev.lesson.trainerId, prevAssignment.roomId, prev.lesson.classId, prevAssignment.day, prevAssignment.periodNumber + 1);
        }

        // Try next candidate for the previous lesson
        const nextChoiceIndex = prev.choiceIndex + 1;
        if (nextChoiceIndex < prev.candidates.length) {
          const nextBest = prev.candidates[nextChoiceIndex];
          const newAssignment = createAssignment(prev.lesson, nextBest);
          assignments.push(newAssignment);
          matrix.markOccupied(prev.lesson.trainerId, nextBest.roomId, prev.lesson.classId, nextBest.day, nextBest.periodNumber);
          if (prev.lesson.isDoublePeriod) {
            matrix.markOccupied(prev.lesson.trainerId, nextBest.roomId, prev.lesson.classId, nextBest.day, nextBest.periodNumber + 1);
          }
          assignmentStack.push({ lesson: prev.lesson, candidates: prev.candidates, choiceIndex: nextChoiceIndex });
          // Retry current lesson
        } else {
          // Previous lesson also exhausted - log conflict for current lesson and move on
          i--;
          conflicts.push(buildConflict(lesson, rooms));
          i += 2; // Skip both
        }
      } else {
        // Backtrack limit reached - log conflict and continue
        conflicts.push(buildConflict(lesson, rooms));
        i++;
      }
    }
  }

  return { assignments, conflicts };
}

function generateCandidates(
  lesson: LessonInstance,
  rooms: RoomInfo[],
  trainers: Map<string, TrainerInfo>,
  matrix: AvailabilityMatrix,
  currentAssignments: SlotAssignment[],
  maxPeriods: number,
  config: SchedulerConfig
): CandidateSlot[] {
  const candidates: CandidateSlot[] = [];

  for (const day of DAYS) {
    const periodLimit = lesson.isDoublePeriod ? maxPeriods - 1 : maxPeriods;
    for (let period = 1; period <= periodLimit; period++) {
      for (const room of rooms) {
        if (checkHardConstraints(lesson, day, period, room, trainers, matrix, maxPeriods)) {
          const penalty = scoreSoftConstraints(
            lesson, day, period, room, currentAssignments, matrix, trainers, config.weights
          );
          candidates.push({ day, periodNumber: period, roomId: room.id, penaltyScore: penalty });
        }
      }
    }
  }

  // Sort by penalty ascending (best first)
  candidates.sort((a, b) => a.penaltyScore - b.penaltyScore);
  return candidates;
}

function createAssignment(lesson: LessonInstance, slot: CandidateSlot): SlotAssignment {
  return {
    lessonInstanceId: lesson.id,
    classId: lesson.classId,
    courseId: lesson.courseId,
    trainerId: lesson.trainerId,
    roomId: slot.roomId,
    day: slot.day,
    periodNumber: slot.periodNumber,
    softPenaltyScore: slot.penaltyScore,
    isLocked: false,
  };
}

function buildConflict(lesson: LessonInstance, rooms: RoomInfo[]): ConflictReport {
  const suitableRooms = rooms.filter(
    r => r.roomType === lesson.requiredRoomType && (r.capacity ?? 0) >= lesson.classSize
  );

  let type: ConflictReport['type'] = 'no_valid_slot';
  let details = `No valid slot found for ${lesson.courseId} in class ${lesson.classId}`;

  if (suitableRooms.length === 0) {
    type = lesson.classSize > 0 ? 'room_capacity' : 'no_room';
    details = `No ${lesson.requiredRoomType} room with capacity >= ${lesson.classSize}`;
  } else if (lesson.isDoublePeriod) {
    type = 'double_period_impossible';
    details = `Cannot find consecutive periods for double-period lesson`;
  }

  return {
    type,
    lessonInstanceId: lesson.id,
    classId: lesson.classId,
    courseId: lesson.courseId,
    trainerId: lesson.trainerId,
    details,
  };
}
