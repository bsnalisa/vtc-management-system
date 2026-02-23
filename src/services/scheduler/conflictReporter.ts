import { ConflictReport } from './types';

/**
 * Formats conflict reports for display.
 */

export interface FormattedConflict {
  icon: string;
  title: string;
  description: string;
  severity: 'error' | 'warning';
  courseName?: string;
  className?: string;
  trainerName?: string;
}

export function formatConflicts(
  conflicts: ConflictReport[],
  courseNames: Map<string, string>,
  classNames: Map<string, string>,
  trainerNames: Map<string, string>
): FormattedConflict[] {
  return conflicts.map(c => {
    const courseName = courseNames.get(c.courseId) || c.courseId;
    const className = classNames.get(c.classId) || c.classId;
    const trainerName = trainerNames.get(c.trainerId) || c.trainerId;

    let icon = '⚠️';
    let title = 'Scheduling Conflict';

    switch (c.type) {
      case 'no_room':
        icon = '🏗️';
        title = 'No Available Room';
        break;
      case 'trainer_overloaded':
        icon = '👨‍🏫';
        title = 'Trainer Overloaded';
        break;
      case 'double_period_impossible':
        icon = '⏱️';
        title = 'Double Period Impossible';
        break;
      case 'room_capacity':
        icon = '📏';
        title = 'Room Capacity Insufficient';
        break;
      case 'no_valid_slot':
        icon = '❌';
        title = 'No Valid Slot';
        break;
    }

    return {
      icon,
      title,
      description: c.details,
      severity: c.type === 'no_valid_slot' ? 'error' : 'warning',
      courseName,
      className,
      trainerName,
    };
  });
}

export function summarizeConflicts(conflicts: ConflictReport[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const c of conflicts) {
    summary[c.type] = (summary[c.type] || 0) + 1;
  }
  return summary;
}
