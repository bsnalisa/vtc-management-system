/**
 * Main entry point for the constraint-based heuristic scheduling engine.
 * Orchestrates: data loading → lesson generation → difficulty sort → placement → optimization → output.
 */

import { AvailabilityMatrix } from './availabilityMatrix';
import { generateLessonInstances, computeDifficultyScores, sortByDifficulty } from './heuristicSorter';
import { runPlacement } from './placementEngine';
import { optimizeTimetable } from './optimizer';
import {
  ClassInfo,
  CourseInfo,
  DEFAULT_CONFIG,
  RoomInfo,
  SchedulerConfig,
  SchedulerResult,
  SlotAssignment,
  TrainerInfo,
} from './types';

export interface SchedulerInput {
  classes: ClassInfo[];
  courses: CourseInfo[];
  trainers: TrainerInfo[];
  rooms: RoomInfo[];
  maxPeriods: number;
  config?: Partial<SchedulerConfig>;
  lockedAssignments?: SlotAssignment[];
}

export function runScheduler(input: SchedulerInput): SchedulerResult {
  const config: SchedulerConfig = { ...DEFAULT_CONFIG, ...input.config };

  // Build trainer lookup map
  const trainerMap = new Map<string, TrainerInfo>();
  for (const t of input.trainers) {
    trainerMap.set(t.id, t);
  }

  // Build class-to-courses mapping
  const classCourseMap = input.classes.map(cls => {
    // Find courses matching the class trade & level
    const classCourses = input.courses.filter(
      c => c.tradeId === cls.tradeId && c.level === cls.level
    );

    // Determine trainer: class trainer or find one matching trade
    let trainerId = cls.trainerId || '';
    if (!trainerId) {
      const matchingTrainer = input.trainers.find(
        t => t.tradeIds.includes(cls.tradeId)
      );
      trainerId = matchingTrainer?.id || '';
    }

    return {
      classId: cls.id,
      classSize: cls.capacity || 30,
      tradeId: cls.tradeId,
      trainerId,
      courses: classCourses,
    };
  }).filter(m => m.courses.length > 0 && m.trainerId);

  // Step 1: Generate lesson instances
  let lessons = generateLessonInstances(classCourseMap);

  // Step 2: Compute difficulty scores
  lessons = computeDifficultyScores(lessons, input.rooms, trainerMap);

  // Step 3: Sort by difficulty (most constrained first)
  lessons = sortByDifficulty(lessons);

  // Step 4: Build availability matrix
  const matrix = new AvailabilityMatrix(
    input.trainers.map(t => t.id),
    input.rooms.map(r => r.id),
    input.classes.map(c => c.id),
    input.maxPeriods
  );

  // Apply locked assignments
  const locked = input.lockedAssignments || [];
  matrix.applyLockedAssignments(locked);

  // Filter out lessons that correspond to locked entries
  const lockedKeys = new Set(
    locked.map(a => `${a.classId}-${a.courseId}-${a.day}-${a.periodNumber}`)
  );
  const unlocked = lessons.filter(l => {
    // Don't filter by specific slot - locked assignments reduce available slots via matrix
    return true;
  });

  // Step 5: Run placement engine
  const { assignments, conflicts } = runPlacement(
    unlocked, input.rooms, trainerMap, matrix, input.maxPeriods, config, locked
  );

  // Step 6: Run optimization passes
  const { assignments: optimized, globalPenalty } = optimizeTimetable(
    assignments, lessons, input.rooms, trainerMap, matrix, input.maxPeriods, config
  );

  return {
    assignments: optimized,
    conflicts,
    globalPenaltyScore: globalPenalty,
    totalLessons: lessons.length + locked.length,
    placedLessons: optimized.length,
    failedLessons: conflicts.length,
  };
}

export * from './types';
export { formatConflicts, summarizeConflicts } from './conflictReporter';
