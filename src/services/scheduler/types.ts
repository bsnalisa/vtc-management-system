// Core types for the constraint-based heuristic scheduling engine

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Day = typeof DAYS[number];

export interface TimePeriod {
  id: string;
  day: Day;
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  label?: string;
}

export interface ClassInfo {
  id: string;
  className: string;
  classCode: string;
  tradeId: string;
  capacity: number;
  level: number;
  trainerId?: string | null;
}

export interface TrainerInfo {
  id: string;
  fullName: string;
  maxWeeklyPeriods: number;
  preferredDailyPeriods: number;
  tradeIds: string[];
}

export interface RoomInfo {
  id: string;
  name: string;
  code: string;
  buildingId: string;
  roomType: 'classroom' | 'lab' | 'workshop';
  capacity: number;
}

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
  tradeId: string;
  level: number;
  periodsPerWeek: number;
  requiredRoomType: 'classroom' | 'lab' | 'workshop';
  isDoublePeriod: boolean;
}

export interface LessonInstance {
  id: string; // generated unique id
  classId: string;
  courseId: string;
  trainerId: string;
  requiredRoomType: 'classroom' | 'lab' | 'workshop';
  isDoublePeriod: boolean;
  classSize: number;
  tradeId: string;
  difficultyScore: number;
}

export interface SlotAssignment {
  lessonInstanceId: string;
  classId: string;
  courseId: string;
  trainerId: string;
  roomId: string;
  day: Day;
  periodNumber: number;
  softPenaltyScore: number;
  isLocked: boolean;
  lockType?: 'trainer' | 'room' | 'time' | 'full';
}

export interface ConflictReport {
  type: 'no_room' | 'trainer_overloaded' | 'double_period_impossible' | 'room_capacity' | 'no_valid_slot';
  lessonInstanceId: string;
  classId: string;
  courseId: string;
  trainerId: string;
  details: string;
}

export interface SoftConstraintWeights {
  trainerGap: number;
  subjectRepeatInDay: number;
  buildingMismatch: number;
  trainerDailyOverload: number;
  subjectSpread: number;
}

export const DEFAULT_WEIGHTS: SoftConstraintWeights = {
  trainerGap: 10,
  subjectRepeatInDay: 8,
  buildingMismatch: 6,
  trainerDailyOverload: 5,
  subjectSpread: 3,
};

export interface SchedulerConfig {
  maxBacktrackDepth: number;
  optimizationPasses: number;
  weights: SoftConstraintWeights;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  maxBacktrackDepth: 50,
  optimizationPasses: 100,
  weights: DEFAULT_WEIGHTS,
};

export interface SchedulerResult {
  assignments: SlotAssignment[];
  conflicts: ConflictReport[];
  globalPenaltyScore: number;
  totalLessons: number;
  placedLessons: number;
  failedLessons: number;
}

export interface CandidateSlot {
  day: Day;
  periodNumber: number;
  roomId: string;
  penaltyScore: number;
}
