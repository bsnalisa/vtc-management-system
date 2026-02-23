import { Day, DAYS, SlotAssignment } from './types';

/**
 * O(1) lookup availability matrices for trainers, rooms, and classes.
 * Core data structure for fast conflict checking.
 */
export class AvailabilityMatrix {
  private trainerMatrix: Map<string, Map<string, boolean[]>>; // trainer -> day -> period[]
  private roomMatrix: Map<string, Map<string, boolean[]>>; // room -> day -> period[]
  private classMatrix: Map<string, Map<string, boolean[]>>; // class -> day -> period[]
  private maxPeriods: number;

  constructor(
    trainerIds: string[],
    roomIds: string[],
    classIds: string[],
    maxPeriods: number
  ) {
    this.maxPeriods = maxPeriods;
    this.trainerMatrix = this.buildMatrix(trainerIds);
    this.roomMatrix = this.buildMatrix(roomIds);
    this.classMatrix = this.buildMatrix(classIds);
  }

  private buildMatrix(ids: string[]): Map<string, Map<string, boolean[]>> {
    const matrix = new Map<string, Map<string, boolean[]>>();
    for (const id of ids) {
      const dayMap = new Map<string, boolean[]>();
      for (const day of DAYS) {
        dayMap.set(day, new Array(this.maxPeriods + 1).fill(true)); // index 0 unused
      }
      matrix.set(id, dayMap);
    }
    return matrix;
  }

  isTrainerAvailable(trainerId: string, day: Day, period: number): boolean {
    return this.trainerMatrix.get(trainerId)?.get(day)?.[period] ?? false;
  }

  isRoomAvailable(roomId: string, day: Day, period: number): boolean {
    return this.roomMatrix.get(roomId)?.get(day)?.[period] ?? false;
  }

  isClassAvailable(classId: string, day: Day, period: number): boolean {
    return this.classMatrix.get(classId)?.get(day)?.[period] ?? false;
  }

  markOccupied(trainerId: string, roomId: string, classId: string, day: Day, period: number): void {
    const t = this.trainerMatrix.get(trainerId)?.get(day);
    if (t) t[period] = false;

    const r = this.roomMatrix.get(roomId)?.get(day);
    if (r) r[period] = false;

    const c = this.classMatrix.get(classId)?.get(day);
    if (c) c[period] = false;
  }

  markAvailable(trainerId: string, roomId: string, classId: string, day: Day, period: number): void {
    const t = this.trainerMatrix.get(trainerId)?.get(day);
    if (t) t[period] = true;

    const r = this.roomMatrix.get(roomId)?.get(day);
    if (r) r[period] = true;

    const c = this.classMatrix.get(classId)?.get(day);
    if (c) c[period] = true;
  }

  /** Count periods used by a trainer on a given day */
  getTrainerDailyLoad(trainerId: string, day: Day): number {
    const periods = this.trainerMatrix.get(trainerId)?.get(day);
    if (!periods) return 0;
    return periods.slice(1).filter(v => !v).length;
  }

  /** Count total weekly periods for a trainer */
  getTrainerWeeklyLoad(trainerId: string): number {
    let total = 0;
    for (const day of DAYS) {
      total += this.getTrainerDailyLoad(trainerId, day);
    }
    return total;
  }

  /** Check if a trainer has a gap (free period between two occupied ones) on a day */
  hasTrainerGap(trainerId: string, day: Day, period: number): boolean {
    const periods = this.trainerMatrix.get(trainerId)?.get(day);
    if (!periods) return false;

    const prevOccupied = period > 1 && !periods[period - 1];
    const nextOccupied = period < this.maxPeriods && !periods[period + 1];
    const hasBefore = period > 1 && periods[period - 1]; // free before
    const hasAfter = period < this.maxPeriods && periods[period + 1]; // free after

    // Gap = occupied somewhere before AND after, but this slot would create idle time
    if (prevOccupied && hasAfter) return false;
    if (nextOccupied && hasBefore) return false;

    // Check if placing here creates a gap
    const anyBefore = periods.slice(1, period).some(v => !v);
    const anyAfter = periods.slice(period + 1).some(v => !v);

    return anyBefore && anyAfter;
  }

  /** Apply locked assignments from existing timetable entries */
  applyLockedAssignments(assignments: SlotAssignment[]): void {
    for (const a of assignments) {
      if (a.isLocked) {
        this.markOccupied(a.trainerId, a.roomId, a.classId, a.day, a.periodNumber);
      }
    }
  }
}
