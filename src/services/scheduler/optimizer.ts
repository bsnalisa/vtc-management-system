import { AvailabilityMatrix } from './availabilityMatrix';
import { checkHardConstraints, scoreSoftConstraints } from './constraintBuilder';
import {
  DAYS,
  RoomInfo,
  SchedulerConfig,
  SlotAssignment,
  TrainerInfo,
  LessonInstance,
} from './types';

/**
 * Post-generation optimizer.
 * Runs N passes, attempting to swap each non-locked lesson to a better slot.
 * Keeps swap only if global penalty improves.
 */

export function optimizeTimetable(
  assignments: SlotAssignment[],
  lessons: LessonInstance[],
  rooms: RoomInfo[],
  trainers: Map<string, TrainerInfo>,
  matrix: AvailabilityMatrix,
  maxPeriods: number,
  config: SchedulerConfig
): { assignments: SlotAssignment[]; globalPenalty: number } {
  let current = [...assignments];
  let globalPenalty = current.reduce((sum, a) => sum + a.softPenaltyScore, 0);

  const lessonMap = new Map(lessons.map(l => [l.id, l]));

  for (let pass = 0; pass < config.optimizationPasses; pass++) {
    let improved = false;

    for (let idx = 0; idx < current.length; idx++) {
      const assignment = current[idx];
      if (assignment.isLocked) continue;

      const lesson = lessonMap.get(assignment.lessonInstanceId);
      if (!lesson) continue;

      // Temporarily free this slot
      matrix.markAvailable(assignment.trainerId, assignment.roomId, assignment.classId, assignment.day, assignment.periodNumber);
      if (lesson.isDoublePeriod) {
        matrix.markAvailable(assignment.trainerId, assignment.roomId, assignment.classId, assignment.day, assignment.periodNumber + 1);
      }

      // Remove from current for scoring context
      const otherAssignments = current.filter((_, i) => i !== idx);

      let bestSlot = assignment;
      let bestPenalty = assignment.softPenaltyScore;

      // Try all alternative slots
      for (const day of DAYS) {
        const periodLimit = lesson.isDoublePeriod ? maxPeriods - 1 : maxPeriods;
        for (let period = 1; period <= periodLimit; period++) {
          for (const room of rooms) {
            if (checkHardConstraints(lesson, day, period, room, trainers, matrix, maxPeriods)) {
              const penalty = scoreSoftConstraints(
                lesson, day, period, room, otherAssignments, matrix, trainers, config.weights
              );
              if (penalty < bestPenalty) {
                bestPenalty = penalty;
                bestSlot = {
                  ...assignment,
                  day,
                  periodNumber: period,
                  roomId: room.id,
                  softPenaltyScore: penalty,
                };
              }
            }
          }
        }
      }

      // Apply best slot
      matrix.markOccupied(bestSlot.trainerId, bestSlot.roomId, bestSlot.classId, bestSlot.day, bestSlot.periodNumber);
      if (lesson.isDoublePeriod) {
        matrix.markOccupied(bestSlot.trainerId, bestSlot.roomId, bestSlot.classId, bestSlot.day, bestSlot.periodNumber + 1);
      }

      if (bestSlot !== assignment) {
        current[idx] = bestSlot;
        improved = true;
      }
    }

    // Early exit if no improvement in this pass
    if (!improved) break;

    globalPenalty = current.reduce((sum, a) => sum + a.softPenaltyScore, 0);
  }

  globalPenalty = current.reduce((sum, a) => sum + a.softPenaltyScore, 0);
  return { assignments: current, globalPenalty };
}
